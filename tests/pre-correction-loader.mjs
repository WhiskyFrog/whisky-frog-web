export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("/facet-visibility")) {
    return {
      url: "data:text/javascript,export%20function%20isPublicHiddenFacetKey()%7Breturn%20false%7D",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
