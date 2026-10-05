import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

/**
 * Center the viewport on a node (used by search hits, drawer jump links, and
 * theme tagged-node lists). Must be used inside a <ReactFlowProvider />.
 */
export function useCenterNode(): (id: string) => void {
  const { getNode, setCenter, fitView } = useReactFlow();
  return useCallback(
    (id: string) => {
      const node = getNode(id);
      if (node) {
        const width = node.measured?.width ?? 180;
        const height = node.measured?.height ?? 96;
        setCenter(node.position.x + width / 2, node.position.y + height / 2, {
          zoom: 1,
          duration: 350,
        });
      } else {
        void fitView({ nodes: [{ id }], duration: 350, padding: 0.6 });
      }
    },
    [getNode, setCenter, fitView]
  );
}
