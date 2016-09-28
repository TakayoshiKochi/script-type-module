import { currentScript, hasNativeSupport } from './utils.js';
import { encode, decode } from '../msg.js';
import Cluster from './cluster.js';
import addModuleTools from './module-tools.js';
import spawn from './spawn.js';
import { ModuleScript, ModuleTree } from './modules.js';
import { importExisting, observe } from './dom.js';
import Registry from './registry.js';

if(!hasNativeSupport()) {
  let cluster = new Cluster(1);

  let registry = new Registry();
  let forEach = Array.prototype.forEach;
  let anonCount = 0;
  let pollyScript = currentScript();
  let includeSourceMaps = pollyScript.dataset.noSm == null;

  addModuleTools(registry);

  function importScript(script) {
    let url = "" + (script.src || new URL('./!anonymous_' + anonCount++, document.baseURI));
    let src = script.src ? undefined : script.textContent;

    return importModule(url, src)
    .then(function(){
      var ev = new Event('load');
      script.dispatchEvent(ev);
    })
    .then(null, function(err){
      console.error(err);
      var ev = new ErrorEvent('error', {
        message: err.message,
        filename: url
      });
      script.dispatchEvent(ev);
    });
  }

  function importModule(url, src){
    let tree = new ModuleTree();

    return fetchModule(url, src, tree)
    .then(function(moduleScript){
      return tree.fetchPromise.then(function(){
        return moduleScript;
      });
    })
    .then(function(moduleScript){
      registry.link(moduleScript);
    });
  }

  function fetchModule(url, src, tree) {
    var promise = registry.fetchPromises.get(url);
    if(!promise) {
      promise = new Promise(function(resolve, reject){
        let moduleScript = new ModuleScript(url, resolve, reject, tree);
        tree.increment();
        let handler = function(msg){
          moduleScript.addMessage(msg);
          fetchTree(moduleScript, tree);
          moduleScript.complete();
        };
        cluster.post({
          type: 'fetch',
          url: url,
          src: src,
          includeSourceMaps: includeSourceMaps
        }, handler);
        registry.add(moduleScript);
      });
      registry.fetchPromises.set(url, promise);
    }
    return promise;
  }

  function fetchTree(moduleScript, tree) {
    let deps = moduleScript.deps;
    let promises = deps.map(function(url){
      return fetchModule(url, null, tree);
    });
    return Promise.all(promises);
  }

  importExisting(importScript);
  observe(importScript);
}
