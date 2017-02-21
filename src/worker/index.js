import '../vendor/escodegen.browser.js';
import acorn from './acorn.js';
import visitors from './visitors.js';
import {
  addModuleTools,
  addModuleNamespace,
  addStrictMode
} from './module-tools.js';
import './source-maps.js';

// Convert script in a HTML module to a valid ES module,
// |moduleHTML| available as a DocumentFragment to the ES module.
function convertHTMLModule2ESModule(html) {
  let script = 'export default __moduleHTML;';

  // Escape HTML for template literal.
  let escapedHTML = html.replace(/\\/g, '\\\\')
                        .replace(/`/g, '\\`')
                        .replace(/\${/g, '\\${');

  // TODO: Use proper HTML parser to do this, instead of regexp.
  // TODO: Only the first script tag is taken care of.
  let scriptStart = html.search(/<script type="module-polyfill">/);
  let scriptEnd = escapedHTML.search(/<\/script>/);

  if (scriptStart >= 0 && scriptEnd > scriptStart) {
    // strlen(<script type="module-polyfill">) = 31
    script = escapedHTML.substr(scriptStart + 31,
                                scriptEnd - (scriptStart + 31));

    // TODO: Do we need to exclude the <script type="module-polyfill">?
    // let preHTML = html.substr(0, scriptStart);
    // strlen(</script>) = 9
    // let postHTML = html.substr(scriptEnd + 9);
    // html = preHTML + postHTML;
  }

  const preamble = `const __moduleHTML = (function() {
                      let div = document.createElement('div');
                      div.innerHTML = \`${escapedHTML}\`;
                      let frag = document.createDocumentFragment();
                      div.childNodes.forEach(node => frag.append(node));
                      return frag;
                    })();`;

  return preamble + script;
}

onmessage = function(ev){
  let msg = ev.data;
  let url = msg.url;
  let includeSourceMaps = msg.includeSourceMaps;

  let fetchPromise = msg.src ? Promise.resolve(msg.src)
    : fetch(url).then(function(resp){
      if (resp.headers.get('Content-Type').startsWith('text/html')) {
        return resp.text().then(function(html) {
          return { src: html, type: 'html' };
        });
      } else {
        return resp.text();
      }
    });

  fetchPromise
  .then(function(src){
    let type = 'script';
    if (typeof(src) === 'object') {
      type = src.type;
      src = convertHTMLModule2ESModule(src.src);
    }
    let state = {
      anonCount: 0,
      deps: [],
      exports: {},
      exportStars: [],
      exportNames: {},
      specifiers: {},
      vars: {},
      url: url
    };
    let parseOptions = {
      sourceType: 'module'
    };
    if(includeSourceMaps) {
      parseOptions.locations = true;
      parseOptions.sourceFile = url;
    }
    let ast = acorn.parse(src, parseOptions);
    acorn.walk.recursive(ast, state, visitors);

    if(state.includesExports) {
      ast.body.unshift(addModuleNamespace());
    }
    if(state.includeTools) {
      ast.body.unshift(addModuleTools(url));
    }
    ast.body.unshift(addStrictMode());
    let codegenOptions = {};
    if(includeSourceMaps) {
      codegenOptions.sourceMap = codegenOptions.sourceMapWithCode = true;
    }
    let result = escodegen.generate(ast, codegenOptions);

    let code = includeSourceMaps ? result.code : result;
    let map = includeSourceMaps ? result.map.toJSON() : undefined;

    return {
      code: code,
      deps: state.deps,
      exports: state.exports,
      exportStars: state.exportStars,
      map: map,
      type: type
    };
  })
  .then(function(res){
    postMessage({
      type: 'fetch',
      exports: res.exports,
      exportStars: res.exportStars,
      deps: res.deps,
      url: url,
      src: res.code,
      map: res.map,
      xtype: res.type
    });
  })
  .then(null, function(err){
    postMessage({
      type: 'error',
      url: url,
      error: {
        message: err.message,
        name: err.name
      }
    });
  });
}
