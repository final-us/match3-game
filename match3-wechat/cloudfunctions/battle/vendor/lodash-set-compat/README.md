# CloudBase field-path compatibility adapter

`@cloudbase/database@1.4.3` expects `require('lodash.set')` to be a callable
`set(object, path, value)`. The standalone `lodash.set@4.3.2` is vulnerable to
prototype pollution and has no fixed standalone release at the time of adoption
(2026-09-15). This internal adapter exports the maintained `lodash@4.18.1/set`
implementation unchanged; it does not copy or rename the vulnerable code.

The parent battle package declares this local package under the `lodash.set`
dependency key and uses a `$lodash.set` override. Its `.npmrc` sets
`install-links=true`: npm packs this directory into `node_modules/lodash.set`
instead of using a machine-dependent symlink. Keep the vendor directory,
`.npmrc`, parent manifest and lockfile together. Install from the battle directory
with `npm ci --ignore-scripts`; do not install this directory on its own or rely
on postinstall patches.

This project's adapter remains private/default-copyright (`UNLICENSED`), not
third-party code with missing license metadata. The actual lodash implementation
is MIT-licensed, copyright OpenJS Foundation and other contributors; its complete
license (including the Underscore attribution) is installed at
`node_modules/lodash/LICENSE` and must remain with the deployed dependency.
Source: https://github.com/lodash/lodash

Removal condition: after Tencent adopts a maintained safe callable implementation,
review that SDK version and remove this adapter/override only when the dependency
security and battle regressions pass again. A zero npm audit count by itself is
not evidence that a local replacement is correct.
