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
  ApiRef,
  IconComponent,
  createApiRef,
} from '@backstage/core-plugin-api';

/**
 * An API that handles how to represent entities in the interface.
 *
 * @public
 */
export const entityPresentationApiRef: ApiRef<EntityPresentationApi> =
  createApiRef({
    id: 'catalog-react.entity-presentation',
  });

/**
 * The visual presentation of an entity reference.
 *
 * @public
 */
export interface EntityRefPresentation {
  entityRef: string;
  primaryTitle: string;
  secondaryTitle?: string;
  Icon?: IconComponent | undefined;
}

/**
 * An API that decides how to visually represent entities in the interface.
 *
 * @public
 */
export interface EntityPresentationApi {
  textualEntityRef(options: {
    entityRef: string;
    variant?: string;
  }): Promise<EntityRefPresentation>;
}
