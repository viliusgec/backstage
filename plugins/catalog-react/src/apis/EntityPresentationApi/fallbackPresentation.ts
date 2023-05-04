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
import { EntityRefPresentation } from './EntityPresentationApi';

/**
 * This is the one used when there's no presentation API available. It does some
 * stuff that looks odd, like lowercasing things unnecessarily. This is just for
 * backward compatibility so that all tests keep working.
 */
export function fallbackPresentation(
  entityOrRef: Entity | CompoundEntityRef | string,
  context?: {
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
