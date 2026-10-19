function isStructuralTabTargetNodeName(nodeName: string): boolean {
  return nodeName === "list" || nodeName === "tableCell" || nodeName === "tableHeaderCell";
}

export { isStructuralTabTargetNodeName };
