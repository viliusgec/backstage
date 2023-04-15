/*
 * Copyright 2020 The Backstage Authors
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
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { Link, LinkProps } from '@backstage/core-components';
import { IconComponent, useApi, useRouteRef } from '@backstage/core-plugin-api';
import { Box, Theme, Tooltip, makeStyles } from '@material-ui/core';
import React, { forwardRef } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { entityPresentationApiRef } from '../../apis';
import { entityRouteRef } from '../../routes';

/** @public */
export type CatalogReactEntityRefLinkClassKey = 'icon';

const useStyles = makeStyles(
  (theme: Theme) => ({
    iconContainer: {
      display: 'inline-flex',
      alignItems: 'center',
    },
    icon: {
      marginRight: theme.spacing(0.5),
      color: theme.palette.text.secondary,
      lineHeight: 0,
    },
  }),
  { name: 'CatalogReactEntityRefLink' },
);

/**
 * Props for {@link EntityRefLink}.
 *
 * @public
 */
export type EntityRefLinkProps = {
  entityRef: Entity | CompoundEntityRef | string;
  defaultKind?: string;
  /** @deprecated This option is no longer used; presentation is handled by entityPresentationApiRef instead */
  title?: string;
  children?: React.ReactNode;
} & Omit<LinkProps, 'to'>;

/**
 * Shows a clickable link to an entity.
 *
 * @public
 */
export const EntityRefLink = forwardRef<any, EntityRefLinkProps>(
  (props, ref) => {
    const { entityRef, defaultKind, title, children, ...linkProps } = props;
    const entityRefString =
      typeof entityRef === 'string' ? entityRef : stringifyEntityRef(entityRef);

    const classes = useStyles();
    const entityRoute = useEntityRoute(props.entityRef);
    const presentationApi = useApi(entityPresentationApiRef);

    // Compute the basic data that underpins the presentation of the entity ref
    const presentation = useAsync(async (): Promise<{
      content: React.ReactNode;
      tooltip?: React.ReactNode;
      Icon?: IconComponent;
    }> => {
      if (children) {
        return { content: children };
      } else if (title) {
        return { content: title };
      }

      try {
        const p = await presentationApi.textualEntityRef({
          entityRef: entityRefString,
          variant: 'icon',
        });
        return {
          content: p.primaryTitle,
          tooltip: p.secondaryTitle,
          Icon: p.Icon,
        };
      } catch {
        return { content: entityRefString };
      }
    }, [entityRef, defaultKind, title, children, presentationApi]);

    // The innermost "body" content
    let content = (
      <>{presentation.loading ? '...' : presentation.value?.content}</>
    );

    // The link that wraps it
    content = (
      <Link {...linkProps} ref={ref} to={entityRoute}>
        {content}
      </Link>
    );

    // Optionally, an icon and wrapper around them both
    if (presentation.value?.Icon) {
      content = (
        <Box component="span" className={classes.iconContainer}>
          <Box component="span" className={classes.icon}>
            <presentation.value.Icon fontSize="inherit" />
          </Box>
          {content}
        </Box>
      );
    }

    // Optionally, a tooltip as the outermost layer
    if (presentation.value?.tooltip) {
      content = (
        <Tooltip enterDelay={1000} title={presentation.value.tooltip}>
          {content}
        </Tooltip>
      );
    }

    return content;
  },
) as (props: EntityRefLinkProps) => JSX.Element;

// Hook that computes the route to a given entity / ref. This is a bit
// contrived, because it tries to retain the casing of the entity name if
// present, but not of other parts. This is in an attempt to make slightly more
// nice-looking URLs.
function useEntityRoute(
  entityRef: Entity | CompoundEntityRef | string,
): string {
  const entityRoute = useRouteRef(entityRouteRef);

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

  return entityRoute({ kind, namespace, name });
}
