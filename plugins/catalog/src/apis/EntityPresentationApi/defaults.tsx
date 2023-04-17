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

import { IconComponent } from '@backstage/core-plugin-api';
import { HumanDuration } from '@backstage/types';
import ApartmentIcon from '@material-ui/icons/Apartment';
import BusinessIcon from '@material-ui/icons/Business';
import ExtensionIcon from '@material-ui/icons/Extension';
import HelpIcon from '@material-ui/icons/Help';
import LibraryAddIcon from '@material-ui/icons/LibraryAdd';
import LocationOnIcon from '@material-ui/icons/LocationOn';
import MemoryIcon from '@material-ui/icons/Memory';
import PeopleIcon from '@material-ui/icons/People';
import PersonIcon from '@material-ui/icons/Person';
import get from 'lodash/get';
import { DefaultEntityPresentationApiRenderer } from './DefaultEntityPresentationApi';

export const DEFAULT_CACHE_TTL: HumanDuration = { seconds: 30 };

export const DEFAULT_BATCH_DELAY: HumanDuration = { milliseconds: 50 };

export const DEFAULT_ENTITY_FIELDS: string[] = [
  'kind',
  'metadata.name',
  'metadata.namespace',
  'metadata.title',
  'metadata.description',
  'metadata.etag',
  'spec.type',
  'spec.profile',
];

export const UNKNOWN_KIND_ICON: IconComponent = HelpIcon;

export const DEFAULT_ICONS: Record<string, IconComponent> = {
  api: ExtensionIcon,
  component: MemoryIcon,
  system: BusinessIcon,
  domain: ApartmentIcon,
  location: LocationOnIcon,
  user: PersonIcon,
  group: PeopleIcon,
  template: LibraryAddIcon,
};

export const defaultRenderer: DefaultEntityPresentationApiRenderer = {
  async: true,

  render: ({
    entityRef,
    loading,
    entity,
    context: { variant /* defaultKind, defaultNamespace */ },
  }) => {
    const kindLower = entityRef.split(':')[0].toLocaleLowerCase('en-US');

    const Icon: IconComponent | undefined =
      variant === 'icon'
        ? DEFAULT_ICONS[kindLower] ?? UNKNOWN_KIND_ICON
        : undefined;

    if (!entity) {
      if (loading) {
        return {
          snapshot: {
            entityRef: entityRef,
            primaryTitle: entityRef,
            Icon,
          },
          loadEntity: true,
        };
      }

      return {
        snapshot: {
          entityRef: entityRef,
          primaryTitle: entityRef,
          Icon,
        },
        loadEntity: true,
      };
    }

    const primary = [
      get(entity, 'spec.profile.displayName'),
      get(entity, 'metadata.title'),
      get(entity, 'metadata.name'),
      entityRef,
    ].filter(candidate => candidate && typeof candidate === 'string')[0]!;

    const secondary = [
      primary !== entityRef ? entityRef : undefined,
      get(entity, 'kind'),
      get(entity, 'spec.type'),
      get(entity, 'metadata.description'),
    ]
      .filter(candidate => candidate && typeof candidate === 'string')
      .join(' | ');

    return {
      snapshot: {
        entityRef: entityRef,
        primaryTitle: primary,
        secondaryTitle: secondary || undefined,
        Icon,
      },
      loadEntity: true,
    };

    /*
    let kind;
    let namespace;
    let name;

    if (typeof entityRef === 'string') {
      const parsed = parseEntityRef(entityRef);
      kind = parsed.kind;
      namespace = parsed.namespace;
      name = parsed.name;
    } else if ('metadata' in entityRef) {
      kind = entityRef.kind;
      namespace = entityRef.metadata.namespace;
      name = entityRef.metadata.name;
    } else {
      kind = entityRef.kind;
      namespace = entityRef.namespace;
      name = entityRef.name;
    }

    kind = kind.toLocaleLowerCase('en-US');
    namespace = namespace?.toLocaleLowerCase('en-US') ?? DEFAULT_NAMESPACE;

    const formattedEntityRefTitle = humanizeEntityRef(
      { kind, namespace, name },
      { defaultKind },
    );
  */
  },
};
