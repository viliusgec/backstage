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
} from '@backstage/plugin-catalog-react';
import { HumanDuration } from '@backstage/types';
import DataLoader from 'dataloader';
import ExpiryMap from 'expiry-map';
import {
  DEFAULT_BATCH_DELAY,
  DEFAULT_CACHE_TTL,
  DEFAULT_ENTITY_FIELDS,
  defaultSimpleStringRepresentation,
} from './defaults';
import { durationToMs } from './util';

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
   * Custom presentation.
   */
  presentation?: {
    /**
     * An extra set of fields to request for entities from the catalog API.
     *
     * @remarks
     *
     * If you supply custom representation functions, you may want to specify
     * this to get additional entity fields. The smaller the set of fields, the
     * more efficient requests will be to the catalog backend.
     *
     * The default set of fields is: kind, metadata.name, metadata.namespace,
     * metadata.title, and spec.profile.
     */
    extraFields?: string[];

    /**
     * A custom renderer.
     */
    render: (options: {
      entityRef: string;
      variant?: string;
      catalogEntity: () => Promise<Entity | undefined>;
    }) => Promise<EntityRefPresentation>;
  };
}

/**
 * Default implementation of the {@link @backstage/plugin-catalog-react#EntityPresentationApi}.
 *
 * @public
 */
export class DefaultEntityPresentationApi implements EntityPresentationApi {
  readonly #loader: DataLoader<string, Entity | undefined>;
  readonly #render: (options: {
    entityRef: string;
    variant?: string;
    catalogEntity: () => Promise<Entity | undefined>;
  }) => Promise<EntityRefPresentation>;

  constructor(options: DefaultEntityPresentationApiOptions) {
    this.#loader = this.#createLoader(options);
    this.#render =
      options.presentation?.render ?? defaultSimpleStringRepresentation;
  }

  async textualEntityRef(options: {
    entityRef: string;
    variant?: string;
  }): Promise<EntityRefPresentation> {
    try {
      return this.#render({
        entityRef: options.entityRef,
        variant: options.variant,
        catalogEntity: () => this.#load(options.entityRef),
      });
    } catch {
      return {
        entityRef: options.entityRef,
        primaryTitle: options.entityRef,
      };
    }
  }

  async #load(entityRef: string): Promise<Entity | undefined> {
    try {
      return await this.#loader.load(entityRef);
    } catch {
      return undefined;
    }
  }

  #createLoader(
    options: DefaultEntityPresentationApiOptions,
  ): DataLoader<string, Entity | undefined> {
    const cacheTtl = durationToMs(options.cacheTtl ?? DEFAULT_CACHE_TTL);
    const batchDelay = durationToMs(options.batchDelay ?? DEFAULT_BATCH_DELAY);
    const entityFields = [
      ...new Set(
        [DEFAULT_ENTITY_FIELDS, options.presentation?.extraFields || []].flat(),
      ),
    ];

    return new DataLoader(
      async (entityRefs: readonly string[]) => {
        const { items } = await options.catalogApi.getEntitiesByRefs({
          entityRefs: entityRefs as string[],
          fields: entityFields,
        });
        return items;
      },
      {
        name: DefaultEntityPresentationApi.name,
        cacheMap: new ExpiryMap(cacheTtl),
        maxBatchSize: 100,
        batchScheduleFn: batchDelay
          ? cb => setTimeout(cb, batchDelay)
          : undefined,
      },
    );
  }
}
