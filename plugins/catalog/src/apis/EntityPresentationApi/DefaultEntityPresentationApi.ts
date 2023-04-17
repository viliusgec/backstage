/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Entity } from '@backstage/catalog-model';
import {
  CatalogApi,
  EntityPresentationApi,
  EntityRefPresentation,
  EntityRefPresentationSnapshot,
} from '@backstage/plugin-catalog-react';
import { HumanDuration } from '@backstage/types';
import DataLoader from 'dataloader';
import ExpiryMap from 'expiry-map';
import ObservableImpl from 'zen-observable';
import {
  DEFAULT_BATCH_DELAY,
  DEFAULT_CACHE_TTL,
  DEFAULT_ENTITY_FIELDS,
  defaultRenderer,
} from './defaults';
import { durationToMs } from './util';
import Observable from 'zen-observable';

/**
 * A custom renderer for the {@link DefaultEntityPresentationApi}.
 *
 * @public
 */
export interface DefaultEntityPresentationApiRenderer {
  /**
   * An extra set of fields to request for entities from the catalog API.
   *
   * @remarks
   *
   * You may want to specify this to get additional entity fields. The smaller
   * the set of fields, the more efficient requests will be to the catalog
   * backend.
   *
   * The default set of fields is: kind, metadata.name, metadata.namespace,
   * metadata.title, metadata.description, metadata.etag, spec.type, and
   * spec.profile.
   *
   * This field is ignored if async is set to false.
   */
  extraFields?: string[];

  /**
   * Whether to request the entity from the catalog API asynchronously.
   *
   * @remarks
   *
   * If this is set to true, entity data will be streamed in from the catalog
   * whenever needed, and the render function may be called more than once:
   * first when no entity data existed (or with old cached data), and then again
   * at a later point when data is loaded from the catalog that proved to be
   * different from the old one.
   *
   * @defaultValue true
   */
  async?: boolean;

  /**
   * The actual render function.
   */
  render: (options: {
    entityRef: string;
    loading: boolean;
    entity: Entity | undefined;
    context: {
      variant?: string;
      defaultKind?: string;
      defaultNamespace?: string;
    };
  }) => {
    snapshot: EntityRefPresentationSnapshot;
  };
}

/**
 * Options for the {@link DefaultEntityPresentationApi}.
 *
 * @public
 */
export interface DefaultEntityPresentationApiOptions {
  /**
   * The catalog API to use.
   */
  catalogApi: CatalogApi;

  /**
   * When to expire entities that have been loaded from the catalog API and
   * cached for a while.
   *
   * @defaultValue 30 seconds
   * @remarks
   *
   * The higher this value, the lower the load on the catalog API, but also the
   * higher the risk of users seeing stale data.
   */
  cacheTtl?: HumanDuration;

  /**
   * For how long to wait before sending a batch of entity references to the
   * catalog API.
   *
   * @defaultValue 50 milliseconds
   * @remarks
   *
   * The higher this value, the greater the chance of batching up requests from
   * across a page, but also the longer the lag time before displaying accurate
   * information.
   */
  batchDelay?: HumanDuration;

  /**
   * A custom renderer, if any.
   */
  renderer?: DefaultEntityPresentationApiRenderer;
}

interface CacheEntry {
  updatedAt: number;
  entity: Entity | undefined;
}

/**
 * Default implementation of the {@link @backstage/plugin-catalog-react#EntityPresentationApi}.
 *
 * @public
 */
export class DefaultEntityPresentationApi implements EntityPresentationApi {
  // Just to not have to recreate a do-nothing observer over and over
  static readonly #dummyObserver: Observable<EntityRefPresentationSnapshot> =
    new ObservableImpl(_subscriber => {});

  // This cache holds on to all entity data ever loaded, no matter how old.
  // Each entry is tagged with a time stamp of when it was inserted. We use
  // this map to be able to always render SOME data even though the
  // information is old. Entities change very rarely, so it's likely that the
  // rendered information was perfectly fine in the first place.
  readonly #cache: Map<string, CacheEntry>;
  readonly #cacheTtlMs: number;
  readonly #loader: DataLoader<string, Entity | undefined>;
  readonly #renderer: DefaultEntityPresentationApiRenderer;

  constructor(options: DefaultEntityPresentationApiOptions) {
    this.#cacheTtlMs = durationToMs(options.cacheTtl ?? DEFAULT_CACHE_TTL);
    this.#cache = new Map();
    this.#loader = this.#createLoader(options);
    this.#renderer = options.renderer ?? defaultRenderer;
  }

  forEntityRef(
    entityRef: string,
    context?: {
      variant?: string;
      defaultKind?: string;
      defaultNamespace?: string;
    },
  ): EntityRefPresentation {
    const cached = this.#cache.get(entityRef);
    const cachedEntity: Entity | undefined = cached?.entity;
    const cacheNeedsUpdate =
      !cached || Date.now() - cached.updatedAt > this.#cacheTtlMs;
    const needsLoad = cacheNeedsUpdate && this.#renderer.async !== false;

    let snapshot: EntityRefPresentationSnapshot;
    try {
      const rendered = this.#renderer.render({
        entityRef,
        loading: needsLoad,
        entity: cachedEntity,
        context: context || {},
      });
      snapshot = rendered.snapshot;
    } catch {
      snapshot = {
        entityRef: entityRef,
        primaryTitle: entityRef,
      };
    }

    if (!needsLoad) {
      return {
        snapshot,
        update$: DefaultEntityPresentationApi.#dummyObserver,
      };
    }

    const updatedEntityPromise = this.#loader
      .load(entityRef)
      .catch(() => undefined);

    return {
      snapshot,
      update$: new ObservableImpl(subscriber => {
        updatedEntityPromise.then(entity => {
          if (entity) {
            const rendered = this.#renderer.render({
              entityRef,
              loading: false,
              entity: entity,
              context: context || {},
            });
            subscriber.next(rendered.snapshot);
          }
        });
      }),
    };
  }

  #createLoader(
    options: DefaultEntityPresentationApiOptions,
  ): DataLoader<string, Entity | undefined> {
    const cacheTtl = durationToMs(options.cacheTtl ?? DEFAULT_CACHE_TTL);
    const batchDelay = durationToMs(options.batchDelay ?? DEFAULT_BATCH_DELAY);

    const entityFields = new Set(DEFAULT_ENTITY_FIELDS);
    options.renderer?.extraFields?.forEach(field => entityFields.add(field));

    return new DataLoader(
      async (entityRefs: readonly string[]) => {
        const { items } = await options.catalogApi.getEntitiesByRefs({
          entityRefs: entityRefs as string[],
          fields: [...entityFields],
        });

        const updatedAt = Date.now();
        entityRefs.forEach((entityRef, index) => {
          this.#cache.set(entityRef, { updatedAt, entity: items[index] });
        });

        return items;
      },
      {
        name: DefaultEntityPresentationApi.name,
        // This cache is the one that the data loader uses internally for
        // memoizing requests; essentially what it achieves is that multiple
        // requests for the same entity ref will be batched up into a single
        // request. We put an expiring map here, which makes it so that it
        // re-fetches data with the expiry cadence of that map. Otherwise it
        // would only fetch a given ref once and then never try again. This
        // cache does therefore not fulfill the same purpose as the one that is
        // in the root of the class.
        cacheMap: new ExpiryMap(cacheTtl),
        maxBatchSize: 100,
        batchScheduleFn: batchDelay
          ? cb => setTimeout(cb, batchDelay)
          : undefined,
      },
    );
  }
}
