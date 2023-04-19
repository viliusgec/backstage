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
import { useRouteRef } from '@backstage/core-plugin-api';
import { Box, Theme, Tooltip, makeStyles } from '@material-ui/core';
import React, { forwardRef } from 'react';
import { useEntityPresentation } from '../../apis';
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
      marginLeft: theme.spacing(0.5),
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

    const classes = useStyles();
    const entityRoute = useEntityRoute(props.entityRef);
    const { primaryTitle, secondaryTitle, Icon } = useEntityPresentation(
      typeof entityRef === 'string' || 'metadata' in entityRef
        ? entityRef
        : stringifyEntityRef(entityRef),
      { variant: 'icon' },
    );

    // The innermost "body" content
    let content = <>{primaryTitle}</>;

    // The link that wraps it
    content = (
      <Link {...linkProps} ref={ref} to={entityRoute}>
        {content}
      </Link>
    );

    // Optionally, an icon and wrapper around them both
    if (Icon) {
      content = (
        <Box component="span" className={classes.iconContainer}>
          {content}
          <Box component="span" className={classes.icon}>
            <Icon fontSize="inherit" />
          </Box>
        </Box>
      );
    }

    // Optionally, a tooltip as the outermost layer
    if (secondaryTitle) {
      content = (
        <Tooltip enterDelay={1500} title={secondaryTitle}>
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
