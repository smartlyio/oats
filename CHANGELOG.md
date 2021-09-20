# 3.0.0

## Deprecate non standard discriminator support.

oats-runtime still has the methods for backwards compatibility with already generated code but those are deprecated

## Faster oneOf matching

Oats now uses runtime type information for picking a better order of oneOf matching. If all the options for oneOf share a required 
enum property with distinct values this property is used to select the schema to try when runtime checking values.

Empirically this gets you close to performance of hand written discriminators without the bother of having to actually write those.

## Use reflection types for runtime checking

Drop generation of make structures in the generated code and instead use the runtime type information to construct the
runtime value checkers when needed. This might help in the size and complexity of the generated code. It at least helps in keeping the 
code generator workable.
