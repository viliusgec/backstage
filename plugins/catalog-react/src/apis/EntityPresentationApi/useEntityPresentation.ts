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

import {
  CompoundEntityRef,
  DEFAULT_NAMESPACE,
  Entity,
  getCompoundEntityRef,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { useApiHolder } from '@backstage/core-plugin-api';
import { Observable } from '@backstage/types';
import { DependencyList, useEffect, useMemo, useRef, useState } from 'react';
import {
  EntityRefPresentation,
  EntityRefPresentationSnapshot,
  entityPresentationApiRef,
} from './EntityPresentationApi';

// This is the one used when there's no presentation API available. It does some
// stuff that looks odd, like lowercasing things unnecessarily. This is just for
// backward compatibility so that all tests keep working.
function fallbackPresentation(
  entityOrRef: Entity | CompoundEntityRef | string,
  context?: {
    variant?: string;
    defaultKind?: string;
    defaultNamespace?: string;
  },
): EntityRefPresentation {
  const entityRef =
    typeof entityOrRef === 'string'
      ? entityOrRef
      : stringifyEntityRef(entityOrRef);

  const compound =
    typeof entityOrRef === 'object' && 'metadata' in entityOrRef
      ? getCompoundEntityRef(entityOrRef)
      : parseEntityRef(entityOrRef);

  let result = compound.name;

  const expectedNamespace = context?.defaultNamespace ?? DEFAULT_NAMESPACE;
  if (
    compound.namespace.toLocaleLowerCase('en-US') !==
    expectedNamespace.toLocaleLowerCase('en-US')
  ) {
    result = `${compound.namespace}/${result}`;
  }

  const existingKind = compound.kind.toLocaleLowerCase('en-US');
  if (existingKind !== context?.defaultKind?.toLocaleLowerCase('en-US')) {
    result = `${existingKind}:${result}`;
  }

  return {
    snapshot: {
      entityRef: entityRef,
      primaryTitle: result,
    },
  };
}

// NOTE(freben): We intentionally do not use the plain useObservable from the
// react-use library here. That hook does not support a dependencies array, and
// also it only subscribes once to the initially passed in observable and won't
// properly react when either initial value or the actual observable changes.
function useUpdatingObservable<T>(
  value: T,
  observable: Observable<T> | undefined,
  deps: DependencyList,
): T {
  const snapshot = useRef(value);
  const [, setCounter] = useState(0);

  useEffect(() => {
    snapshot.current = value;
    setCounter(counter => counter + 1);

    const subscription = observable?.subscribe({
      next: updatedValue => {
        snapshot.current = updatedValue;
        setCounter(counter => counter + 1);
      },
      complete: () => {
        subscription?.unsubscribe();
      },
    });

    return () => {
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return snapshot.current;
}

/**
 * Returns information about how to represent an entity in the interface.
 *
 * @public
 * @param entityOrRef - The entity to represent, or an entity ref to it. If you
 *   pass in an entity, it is assumed that it is not a partial one - i.e. only
 *   pass in an entity if you know that it was fetched in such a way that it
 *   contains all of the fields that the representation renderer needs.
 * @param context - Optional context that control details of the presentation.
 * @returns A snapshot of the entity presentation, which may change over time
 */
export function useEntityPresentation(
  entityOrRef: Entity | CompoundEntityRef | string,
  context?: {
    variant?: string;
    defaultKind?: string;
    defaultNamespace?: string;
  },
): EntityRefPresentationSnapshot {
  // Defensively allow for a missing presentation API, which makes this hook
  // safe to use in tests.
  const apis = useApiHolder();
  const entityPresentationApi = apis.get(entityPresentationApiRef);

  const deps = [
    entityPresentationApi,
    JSON.stringify(entityOrRef),
    JSON.stringify(context || null),
  ];

  const presentation = useMemo<EntityRefPresentation>(
    () => {
      if (!entityPresentationApi) {
        return fallbackPresentation(entityOrRef, context);
      }

      return entityPresentationApi.forEntity(
        typeof entityOrRef === 'string' || 'metadata' in entityOrRef
          ? entityOrRef
          : stringifyEntityRef(entityOrRef),
        context,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  return useUpdatingObservable(presentation.snapshot, presentation.update$, [
    presentation,
  ]);
}
