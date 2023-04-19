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
import { useApi } from '@backstage/core-plugin-api';
import { useMemo } from 'react';
import useObservable from 'react-use/lib/useObservable';
import {
  EntityRefPresentationSnapshot,
  entityPresentationApiRef,
} from './EntityPresentationApi';

/**
 * Returns information about how to represent an entity in the interface.
 *
 * @public
 * @param entityOrRef The entity to represent, or a string ref to it. If you
 *   pass in an entity, it is assumed that it is not a partial one - i.e. only
 *   pass in an entity if you know that it was fetched in such a way that it
 *   contains all of the fields that the representation renderer needs.
 * @returns A snapshot of the entity presentation, which may change over time
 */
export function useEntityPresentation(
  entityOrRef: Entity | string,
  context?: {
    variant?: string;
    defaultKind?: string;
    defaultNamespace?: string;
  },
): EntityRefPresentationSnapshot {
  const entityPresentationApi = useApi(entityPresentationApiRef);

  const presentation = useMemo(
    () => entityPresentationApi.forEntity(entityOrRef, context),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityPresentationApi, entityOrRef, JSON.stringify(context || null)],
  );

  const snapshot = useObservable(presentation.update$, presentation.snapshot);

  return snapshot;
}
