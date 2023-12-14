/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import React, {
  CSSProperties,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {usePrismTheme} from '@docusaurus/theme-common';
import clsx from 'clsx';
import nullthrows from 'nullthrows';
import {LiveProvider, LiveEditor, LivePreview, LiveError} from 'react-live';
import EditorToolbar from './EditorToolbar';

import type {FlexStyle} from './FlexStyle';
import type {StyleNode} from './YogaViewer';

import styles from './Playground.module.css';

const defaultCode = `
<Layout config={{useWebDefaults: false}}>
  <Node style={{width: 350, height: 350, padding: 20}}>
    <Node style={{flex: 1}} />
  </Node>
</Layout>
`.trim();

export type Props = Readonly<{
  code?: string;
  height?: CSSProperties['height'];
  autoFocus?: boolean;
}>;

export default function Playground({code, height, autoFocus}: Props) {
  const prismTheme = usePrismTheme();
  const playgroundRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [liveCode, setLiveCode] = useState(code ?? defaultCode);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const LivePreviewWrapper = useCallback(
    (props: React.ComponentProps<'div'>) => {
      useEffect(() => {
        setIsLoaded(true);
      }, []);

      return <div {...props} className={styles.livePreviewWrapper} />;
    },
    [],
  );

  useEffect(() => {
    // TODO: This is hacky and relies on being called after some operation
    // "react-live" does which itself can manipulate global focus
    if (isLoaded && autoFocus) {
      const codeElem = playgroundRef?.current?.querySelector('.prism-code');
      const sel = window.getSelection();
      if (codeElem?.clientHeight && sel != null) {
        sel.selectAllChildren(codeElem);
        sel.collapseToStart();
      }
    }
  }, [isLoaded, autoFocus]);

  useLayoutEffect(() => {
    // The toolbar is positioned relative to the outside of the scrolling
    // container so it stays in the same place when scrolling, but this means
    // it isn't automatically adjusted for scrollbar width
    if (editorScrollRef.current) {
      setScrollbarWidth(
        editorScrollRef.current.offsetWidth -
          editorScrollRef.current.clientWidth,
      );
    }
  });

  const heightStyle = height
    ? ({'--yg-playground-height': height} as React.CSSProperties)
    : undefined;

  return (
    <LiveProvider code={liveCode} theme={prismTheme} scope={{Layout, Node}}>
      <div className={styles.wrapper} ref={playgroundRef} style={heightStyle}>
        <div className={clsx(styles.playgroundRow, 'container')}>
          <div className={clsx(styles.editorColumn, 'playground-editor')}>
            <div className={styles.editorScroll} ref={editorScrollRef}>
              <EditorToolbar
                className={styles.editorToolbar}
                style={{paddingRight: scrollbarWidth + 'px'}}
                getCode={useCallback(
                  () =>
                    nullthrows(
                      playgroundRef.current?.querySelector('.prism-code')
                        ?.textContent,
                    ),
                  [],
                )}
              />
              <LiveEditor
                className={clsx(styles.playgroundEditor)}
                onChange={setLiveCode}
              />
            </div>
          </div>
          <div className={clsx(styles.previewColumn)}>
            <LivePreview
              className={clsx(styles.livePreview)}
              Component={LivePreviewWrapper}
            />
            <LiveError className={clsx(styles.liveError)} />
          </div>
        </div>
      </div>
    </LiveProvider>
  );
}

type LayoutProps = Readonly<{
  children: React.ReactNode;
  config?: {useWebDefaults?: boolean};
}>;

function Layout({children, config}: LayoutProps) {
  if (React.Children.count(children) !== 1) {
    return null;
  }

  const child = React.Children.only(children);
  if (!React.isValidElement(child) || child.type !== Node) {
    return null;
  }

  const styleNode = styleNodeFromYogaNode(child as unknown as Node);

  return (
    <Suspense fallback={null}>
      <LazyYogaViewer
        rootNode={styleNode}
        useWebDefaults={config?.useWebDefaults}
      />
    </Suspense>
  );
}

type NodeProps = Readonly<{
  children: React.ReactNode;
  style: FlexStyle;
}>;

class Node extends React.PureComponent<NodeProps> {}

function styleNodeFromYogaNode(
  yogaNode: React.ElementRef<typeof Node>,
): StyleNode {
  const children: StyleNode[] = [];

  React.Children.forEach(yogaNode.props.children, child => {
    if (React.isValidElement(child) && child.type === Node) {
      children.push(styleNodeFromYogaNode(child as unknown as Node));
    }
  });

  return {
    style: yogaNode.props.style,
    children,
  };
}

// Docusaurus SSR does not correctly support top-level await in the import
// chain
// 1. https://github.com/facebook/docusaurus/issues/7238
// 2. https://github.com/facebook/docusaurus/issues/9468
const LazyYogaViewer = lazy(() => import('./YogaViewer'));
