# HTML modules polyfill

## Caveats

This is an experimental polyfill for designing HTML modules.
Do not take this as an official spec/behavior.

See [gh-pages branch](https://github.com/TakayoshiKochi/script-type-module/tree/gh-pages) or [GitHub pages](https://takayoshikochi.github.io/script-type-module/).

## How to use

Not like the original script, this module doesn't have its own name for npm registry.  If you want to use the polyfill, copy `polyfill.js` and `worker.js` from the repository to your project, and include `polyfill.js` via
```html
<script src="./polyfill.js"></script>
```

 `worker.js` is loaded from `polyfill.js` as a web worker, so you don't have to load explicitly.

Then you can play with HTML modules:
```html
<script type="module-polyfill" src="./foo.js"></script>
<script type="module-polyfill">
import fragment from "./bar.html";
document.body.appendChild(fragment);
</script>
```

## Appendix

### How it works?

The original `polyfill.js` instantiates a worker using `worker.js`. `Polyfill.js` does handling of `<script type=”module-polyfill”>` tags, and passes the URL to the worker for fetching the script.  The worker.js does fetch, transpilation (uses acorn.js and escodegen.js to get AST, then does dependency check, namespace addition, etc. then convert back to ES5 classic script). The transpiled code, list of exports and all dependencies are passed back to `polyfill.js` for evaluation. For resolving dependency, new requests will be posted to `worker.js` until all dependencies are resolved.

HTML modules polyfill hooks `worker.js` to convert loaded HTML into an ES module-like script, then let the rest be done in the original `worker.js` (done in convertHTMLModule2ESModule() function in [src/worker/index.js](https://github.com/TakayoshiKochi/script-type-module/blob/html-module-experiment/src/worker/index.js#L13)).

### Source code organization

All the source for `polyfill.js` reside in src/window directory and those for `worker.js` reside in src/worker. Other third-party code is located in src/vendor.

### Building polyfill.js/worker.js

Build procedure is in `package.json` file in the top directory.

```sh
% npm run-script build
```

will build `polyfill.js` and `worker.js` in the top directory.
