/**!
 * AngularJS file upload shim for angular XHR HTML5 browsers
 * @author  Danial  <danial.farid@gmail.com>
 * @version 1.4.0
 */
if (window.XMLHttpRequest) {
	if (window.FormData) {
	    // allow access to Angular XHR private field: https://github.com/angular/angular.js/issues/1934
		XMLHttpRequest = (function(origXHR) {
			return function() {
				var xhr = new origXHR();
				xhr.setRequestHeader = (function(orig) {
					return function(header, value) {
						if (header === '__setXHR_') {
							var val = value(xhr);
							// fix for angular < 1.2.0
							if (val instanceof Function) {
								val(xhr);
							}
						} else {
							orig.apply(xhr, arguments);
						}
					}
				})(xhr.setRequestHeader);
				return xhr;
			}
		})(XMLHttpRequest);
		window.XMLHttpRequest.__isShim = true;
	}
}

/**!
 * AngularJS file upload shim for HTML5 FormData
 * @author  Danial  <danial.farid@gmail.com>
 * @version 1.4.0
 */
(function() {

var hasFlash = function() {
	try {
	  var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
	  if (fo) return true;
	} catch(e) {
	  if (navigator.mimeTypes["application/x-shockwave-flash"] != undefined) return true;
	}
	return false;
}

var patchXHR = function(fnName, newFn) {
	window.XMLHttpRequest.prototype[fnName] = newFn(window.XMLHttpRequest.prototype[fnName]);
};

if (window.XMLHttpRequest) {
	if (window.FormData) {
		// allow access to Angular XHR private field: https://github.com/angular/angular.js/issues/1934
		patchXHR("setRequestHeader", function(orig) {
			return function(header, value) {
				if (header === '__setXHR_') {
					var val = value(this);
					// fix for angular < 1.2.0
					if (val instanceof Function) {
						val(this);
					}
				} else {
					orig.apply(this, arguments);
				}
			}
		});
	} else {
		function initializeUploadListener(xhr) {
			if (!xhr.__listeners) {
				if (!xhr.upload) xhr.upload = {};
				xhr.__listeners = [];
				var origAddEventListener = xhr.upload.addEventListener;
				xhr.upload.addEventListener = function(t, fn, b) {
					xhr.__listeners[t] = fn;
					origAddEventListener && origAddEventListener.apply(this, arguments);
				};
			}
		}
		
		patchXHR("open", function(orig) {
			return function(m, url, b) {
				initializeUploadListener(this);
				this.__url = url;
				orig.apply(this, [m, url, b]);
			}
		});

		patchXHR("getResponseHeader", function(orig) {
			return function(h) {
				return this.__fileApiXHR ? this.__fileApiXHR.getResponseHeader(h) : orig.apply(this, [h]);
			};
		});

		patchXHR("getAllResponseHeaders", function(orig) {
			return function() {
				return this.__fileApiXHR ? this.__fileApiXHR.abort() : (orig == null ? null : orig.apply(this));
			}
		});

		patchXHR("abort", function(orig) {
			return function() {
				return this.__fileApiXHR ? this.__fileApiXHR.abort() : (orig == null ? null : orig.apply(this));
			}
		});

		patchXHR("setRequestHeader", function(orig) {
			return function(header, value) {
				if (header === '__setXHR_') {
					initializeUploadListener(this);
					var val = value(this);
					// fix for angular < 1.2.0
					if (val instanceof Function) {
						val(this);
					}
				} else {
					this.__requestHeaders = this.__requestHeaders || {};
					this.__requestHeaders[header] = value;
					orig.apply(this, arguments);
				}
			}
		});

		patchXHR("send", function(orig) {
			return function() {
				var xhr = this;
				if (arguments[0] && arguments[0].__isShim) {
					var formData = arguments[0];
					var config = {
						url: xhr.__url,
						complete: function(err, fileApiXHR) {
							if (!err && xhr.__listeners['load']) 
								xhr.__listeners['load']({type: 'load', loaded: xhr.__loaded, total: xhr.__total, target: xhr, lengthComputable: true});
							if (!err && xhr.__listeners['loadend']) 
								xhr.__listeners['loadend']({type: 'loadend', loaded: xhr.__loaded, total: xhr.__total, target: xhr, lengthComputable: true});
							if (err === 'abort' && xhr.__listeners['abort']) 
								xhr.__listeners['abort']({type: 'abort', loaded: xhr.__loaded, total: xhr.__total, target: xhr, lengthComputable: true});
							if (fileApiXHR.status !== undefined) Object.defineProperty(xhr, 'status', {get: function() {return fileApiXHR.status}});
							if (fileApiXHR.statusText !== undefined) Object.defineProperty(xhr, 'statusText', {get: function() {return fileApiXHR.statusText}});
							Object.defineProperty(xhr, 'readyState', {get: function() {return 4}});
							if (fileApiXHR.response !== undefined) Object.defineProperty(xhr, 'response', {get: function() {return fileApiXHR.response}});
							Object.defineProperty(xhr, 'responseText', {get: function() {return fileApiXHR.responseText}});
							xhr.__fileApiXHR = fileApiXHR;
							xhr.onreadystatechange();
						},
						fileprogress: function(e) {
							e.target = xhr;
							xhr.__listeners['progress'] && xhr.__listeners['progress'](e);
							xhr.__total = e.total;
							xhr.__loaded = e.loaded;
						},
						headers: xhr.__requestHeaders
					}
					config.data = {};
					config.files = {}
					for (var i = 0; i < formData.data.length; i++) {
						var item = formData.data[i];
						if (item.val != null && item.val.name != null && item.val.size != null && item.val.type != null) {
							config.files[item.key] = item.val;
						} else {
							config.data[item.key] = item.val;
						}
					}

					setTimeout(function() {
						if (!hasFlash()) {
							throw 'Adode Flash Player need to be installed. To check ahead use "FileAPI.hasFlash"';
						}
						xhr.__fileApiXHR = FileAPI.upload(config);
					}, 1);
				} else {
					orig.apply(xhr, arguments);
				}
			}
		});
	}
	window.XMLHttpRequest.__isShim = true;
}

if (!window.FormData) {
	var wrapFileApi = function(elem) {
		if (!hasFlash()) {
			throw 'Adode Flash Player need to be installed. To check ahead use "FileAPI.hasFlash"';
		}
		if (!elem.__isWrapped && (elem.getAttribute('ng-file-select') != null || elem.getAttribute('data-ng-file-select') != null)) {
			var wrap = document.createElement('div');
			wrap.innerHTML = '<div class="js-fileapi-wrapper" style="position:relative; overflow:hidden"></div>';
			wrap = wrap.firstChild;
			var parent = elem.parentNode;
			parent.insertBefore(wrap, elem);
			parent.removeChild(elem);
			wrap.appendChild(elem);
			elem.__isWrapped = true;
		}
	};
	var changeFnWrapper = function(fn) {
		return function(evt) {
			var files = FileAPI.getFiles(evt);
			if (!evt.target) {
				evt.target = {};
			}
			evt.target.files = files;
			evt.target.files.item = function(i) {
				return evt.target.files[i] || null;
			}
			fn(evt);
		};
	};
	var isFileChange = function(elem, e) {
		return (e.toLowerCase() === 'change' || e.toLowerCase() === 'onchange') && elem.getAttribute('type') == 'file';
	}
	if (HTMLInputElement.prototype.addEventListener) {
		HTMLInputElement.prototype.addEventListener = (function(origAddEventListener) {
			return function(e, fn, b, d) {
				if (isFileChange(this, e)) {
					wrapFileApi(this);
					origAddEventListener.apply(this, [e, changeFnWrapper(fn), b, d]);
				} else {
					origAddEventListener.apply(this, [e, fn, b, d]);
				}
			}
		})(HTMLInputElement.prototype.addEventListener);
	}
	if (HTMLInputElement.prototype.attachEvent) {
		HTMLInputElement.prototype.attachEvent = (function(origAttachEvent) {
			return function(e, fn) {
				if (isFileChange(this, e)) {
					wrapFileApi(this);
					origAttachEvent.apply(this, [e, changeFnWrapper(fn)]);
				} else {
					origAttachEvent.apply(this, [e, fn]);
				}
			}
		})(HTMLInputElement.prototype.attachEvent);
	}

	window.FormData = FormData = function() {
		return {
			append: function(key, val, name) {
				this.data.push({
					key: key,
					val: val,
					name: name
				});
			},
			data: [],
			__isShim: true
		};
	};

	(function () {
		//load FileAPI
		if (!window.FileAPI) {
			window.FileAPI = {};
		}
		if (!FileAPI.upload) {
			var jsUrl, basePath, script = document.createElement('script'), allScripts = document.getElementsByTagName('script'), i, index, src;
			if (window.FileAPI.jsUrl) {
				jsUrl = window.FileAPI.jsUrl;
			} else if (window.FileAPI.jsPath) {
				basePath = window.FileAPI.jsPath;
			} else {
				for (i = 0; i < allScripts.length; i++) {
					src = allScripts[i].src;
					index = src.indexOf('angular-file-upload-shim.js')
					if (index == -1) {
						index = src.indexOf('angular-file-upload-shim.min.js');
					}
					if (index > -1) {
						basePath = src.substring(0, index);
						break;
					}
				}
			}

			if (FileAPI.staticPath == null) FileAPI.staticPath = basePath;
			script.setAttribute('src', jsUrl || basePath + "FileAPI.min.js");
			document.getElementsByTagName('head')[0].appendChild(script);
			FileAPI.hasFlash = hasFlash();
		}
	})();
}


if (!window.FileReader) {
	window.FileReader = function() {
		var _this = this, loadStarted = false;
		this.listeners = {};
		this.addEventListener = function(type, fn) {
			_this.listeners[type] = _this.listeners[type] || [];
			_this.listeners[type].push(fn);
		};
		this.removeEventListener = function(type, fn) {
			_this.listeners[type] && _this.listeners[type].splice(_this.listeners[type].indexOf(fn), 1);
		};
		this.dispatchEvent = function(evt) {
			var list = _this.listeners[evt.type];
			if (list) {
				for (var i = 0; i < list.length; i++) {
					list[i].call(_this, evt);
				}
			}
		};
		this.onabort = this.onerror = this.onload = this.onloadstart = this.onloadend = this.onprogress = null;

		function constructEvent(type, evt) {
			var e = {type: type, target: _this, loaded: evt.loaded, total: evt.total, error: evt.error};
			if (evt.result != null) e.target.result = evt.result;
			return e;
		};
		var listener = function(evt) {
			if (!loadStarted) {
				loadStarted = true;
				_this.onloadstart && this.onloadstart(constructEvent('loadstart', evt));
			}
			if (evt.type === 'load') {
				_this.onloadend && _this.onloadend(constructEvent('loadend', evt));
				var e = constructEvent('load', evt);
				_this.onload && _this.onload(e);
				_this.dispatchEvent(e);
			} else if (evt.type === 'progress') {
				var e = constructEvent('progress', evt);
				_this.onprogress && _this.onprogress(e);
				_this.dispatchEvent(e);
			} else {
				var e = constructEvent('error', evt);
				_this.onerror && _this.onerror(e);
				_this.dispatchEvent(e);
			}
		};
		this.readAsArrayBuffer = function(file) {
			FileAPI.readAsBinaryString(file, listener);
		}
		this.readAsBinaryString = function(file) {
			FileAPI.readAsBinaryString(file, listener);
		}
		this.readAsDataURL = function(file) {
			FileAPI.readAsDataURL(file, listener);
		}
		this.readAsText = function(file) {
			FileAPI.readAsText(file, listener);
		}
	}
}

})();

/**!
 * AngularJS file upload/drop directive with http post and progress
 * @author  Danial  <danial.farid@gmail.com>
 * @version 1.4.0
 */
(function() {
	
var angularFileUpload = angular.module('angularFileUpload', []);

angularFileUpload.service('$upload', ['$http', '$timeout', function($http, $timeout) {
	function sendHttp(config) {
		config.method = config.method || 'POST';
		config.headers = config.headers || {};
		config.transformRequest = config.transformRequest || function(data, headersGetter) {
			if (window.ArrayBuffer && data instanceof window.ArrayBuffer) {
				return data;
			}
			return $http.defaults.transformRequest[0](data, headersGetter);
		};

		if (window.XMLHttpRequest.__isShim) {
			config.headers['__setXHR_'] = function() {
				return function(xhr) {
					if (!xhr) return;
					config.__XHR = xhr;
					config.xhrFn && config.xhrFn(xhr);
					xhr.upload.addEventListener('progress', function(e) {
						if (config.progress) {
							$timeout(function() {
								if(config.progress) config.progress(e);
							});
						}
					}, false);
					//fix for firefox not firing upload progress end, also IE8-9
					xhr.upload.addEventListener('load', function(e) {
						if (e.lengthComputable) {
							if(config.progress) config.progress(e);
						}
					}, false);
				};
			};
		}

		var promise = $http(config);

		promise.progress = function(fn) {
			config.progress = fn;
			return promise;
		};
		promise.abort = function() {
			if (config.__XHR) {
				$timeout(function() {
					config.__XHR.abort();
				});
			}
			return promise;
		};
		promise.xhr = function(fn) {
			config.xhrFn = fn;
			return promise;
		};
		promise.then = (function(promise, origThen) {
			return function(s, e, p) {
				config.progress = p || config.progress;
				var result = origThen.apply(promise, [s, e, p]);
				result.abort = promise.abort;
				result.progress = promise.progress;
				result.xhr = promise.xhr;
				result.then = promise.then;
				return result;
			};
		})(promise, promise.then);
		
		return promise;
	}

	this.upload = function(config) {
		config.headers = config.headers || {};
		config.headers['Content-Type'] = undefined;
		config.transformRequest = config.transformRequest || $http.defaults.transformRequest;
		var formData = new FormData();
		var origTransformRequest = config.transformRequest;
		var origData = config.data;
		config.transformRequest = function(formData, headerGetter) {
			if (origData) {
				if (config.formDataAppender) {
					for (var key in origData) {
						var val = origData[key];
						config.formDataAppender(formData, key, val);
					}
				} else {
					for (var key in origData) {
						var val = origData[key];
						if (typeof origTransformRequest == 'function') {
							val = origTransformRequest(val, headerGetter);
						} else {
							for (var i = 0; i < origTransformRequest.length; i++) {
								var transformFn = origTransformRequest[i];
								if (typeof transformFn == 'function') {
									val = transformFn(val, headerGetter);
								}
							}
						}
						formData.append(key, val);
					}
				}
			}

			if (config.file != null) {
				var fileFormName = config.fileFormDataName || 'file';

				if (Object.prototype.toString.call(config.file) === '[object Array]') {
					var isFileFormNameString = Object.prototype.toString.call(fileFormName) === '[object String]'; 
					for (var i = 0; i < config.file.length; i++) {
						formData.append(isFileFormNameString ? fileFormName + i : fileFormName[i], config.file[i], config.file[i].name);
					}
				} else {
					formData.append(fileFormName, config.file, config.file.name);
				}
			}
			return formData;
		};

		config.data = formData;

		return sendHttp(config);
	};

	this.http = function(config) {
		return sendHttp(config);
	}
}]);

angularFileUpload.directive('ngFileSelect', [ '$parse', '$timeout', function($parse, $timeout) {
	return function(scope, elem, attr) {
		var fn = $parse(attr['ngFileSelect']);
		elem.bind('change', function(evt) {
			var files = [], fileList, i;
			fileList = evt.target.files;
			if (fileList != null) {
				for (i = 0; i < fileList.length; i++) {
					files.push(fileList.item(i));
				}
			}
			$timeout(function() {
				fn(scope, {
					$files : files,
					$event : evt
				});
			});
		});
		// removed this since it was confusing if the user click on browse and then cancel #181
//		elem.bind('click', function(){
//			this.value = null;
//		});
		
		// touch screens
		if (('ontouchstart' in window) ||
				(navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)) {
			elem.bind('touchend', function(e) {
				e.preventDefault();
				e.target.click();
			});
		}
	};
} ]);

angularFileUpload.directive('ngFileDropAvailable', [ '$parse', '$timeout', function($parse, $timeout) {
	return function(scope, elem, attr) {
		if ('draggable' in document.createElement('span')) {
			var fn = $parse(attr['ngFileDropAvailable']);
			$timeout(function() {
				fn(scope);
			});
		}
	};
} ]);

angularFileUpload.directive('ngFileDrop', [ '$parse', '$timeout', function($parse, $timeout) {
	return function(scope, elem, attr) {		
		if ('draggable' in document.createElement('span')) {
			var cancel = null;
			var fn = $parse(attr['ngFileDrop']);
			elem[0].addEventListener("dragover", function(evt) {
				$timeout.cancel(cancel);
				evt.stopPropagation();
				evt.preventDefault();
				elem.addClass(attr['ngFileDragOverClass'] || "dragover");
			}, false);
			elem[0].addEventListener("dragleave", function(evt) {
				cancel = $timeout(function() {
					elem.removeClass(attr['ngFileDragOverClass'] || "dragover");
				});
			}, false);
			
			var processing = 0;
			function traverseFileTree(files, item) {
				if (item.isDirectory) {
					var dirReader = item.createReader();
					processing++;
					dirReader.readEntries(function(entries) {
						for (var i = 0; i < entries.length; i++) {
							traverseFileTree(files, entries[i]);
						}
						processing--;
					});
				} else {
					processing++;
		    	    item.file(function(file) {
		    	    	processing--;
		    	    	files.push(file);
		    	    });
	    	  }
			}
			
			elem[0].addEventListener("drop", function(evt) {
				evt.stopPropagation();
				evt.preventDefault();
				elem.removeClass(attr['ngFileDragOverClass'] || "dragover");
				var files = [], items = evt.dataTransfer.items;
				if (items && items.length > 0 && items[0].webkitGetAsEntry) {
					for (var i = 0; i < items.length; i++) {
						traverseFileTree(files, items[i].webkitGetAsEntry());
					}
				} else {
					var fileList = evt.dataTransfer.files;
					if (fileList != null) {
						for (var i = 0; i < fileList.length; i++) {
							files.push(fileList.item(i));
						}
					}
				}
				(function callback(delay) {
					$timeout(function() {
						if (!processing) {
							fn(scope, {
								$files : files,
								$event : evt
							});
						} else {
							callback(10);
						}
					}, delay || 0)
				})();
			}, false);
		}
	};
} ]);

})();

'use strict';

angular
  .module('commonsCloudAdminApp', [
    'ivpusic.cookie',
    'ngResource',
    'ngSanitize',
    'ngRoute',
    'ngAnimate',
    'ui.gravatar',
    'leaflet-directive',
    'angularFileUpload',
    'geolocation'
  ])
  .config(['$routeProvider', '$locationProvider', '$httpProvider', function($routeProvider, $locationProvider, $httpProvider) {

    // Setup routes for our application
    $routeProvider
      .when('/', {
        templateUrl: '/views/index.html',
        controller: 'IndexCtrl'
      })
      .when('/authorize', {
        templateUrl: '/views/authorize.html',
        controller: 'AuthorizeCtrl'
      })
      .when('/applications', {
        templateUrl: '/views/applications.html',
        controller: 'ApplicationsCtrl'
      })
      .when('/applications/new', {
        templateUrl: '/views/application-create.html',
        controller: 'ApplicationCreateCtrl'
      })
      .when('/applications/:applicationId', {
        templateUrl: '/views/application.html',
        controller: 'ApplicationCtrl'
      })
      .when('/applications/:applicationId/edit', {
        templateUrl: '/views/application-edit.html',
        controller: 'ApplicationEditCtrl'
      })
      .when('/applications/:applicationId/collections', {
        redirectTo: '/applications/:applicationId'
      })
      .when('/applications/:applicationId/collaborators', {
        templateUrl: '/views/collaborators.html',
        controller: 'CollaboratorsCtrl'
      })
      .when('/applications/:applicationId/collections/new', {
        templateUrl: '/views/template-create.html',
        controller: 'TemplateCreateCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/features', {
        templateUrl: '/views/features.html',
        controller: 'FeaturesCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/features/new', {
        templateUrl: '/views/feature-create.html',
        controller: 'FeatureCreateCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/features/:featureId', {
        templateUrl: '/views/feature-edit.html',
        controller: 'FeatureEditCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId', {
        redirectTo: '/applications/:applicationId/collections/:templateId/features'
      })
      .when('/applications/:applicationId/collections/:templateId/statistics', {
        templateUrl: '/views/statistics.html',
        controller: 'StatisticsCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/statistics/new', {
        templateUrl: '/views/statistic-create.html',
        controller: 'StatisticCreateCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/statistics/:statisticId', {
        templateUrl: '/views/statistic-edit.html',
        controller: 'StatisticEditCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/fields', {
        templateUrl: '/views/fields.html',
        controller: 'FieldsCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/fields/new', {
        templateUrl: '/views/field-create.html',
        controller: 'FieldCreateCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/fields/:fieldId/edit', {
        templateUrl: '/views/field-edit.html',
        controller: 'FieldEditCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/settings', {
        templateUrl: '/views/template-edit.html',
        controller: 'TemplateEditCtrl'
      })
      .when('/applications/:applicationId/collections/:templateId/developers', {
        templateUrl: '/views/template-dev.html',
        controller: 'TemplateDevCtrl'
      })
      .otherwise({
        templateUrl: '/views/errors/404.html'
      });

    // If you remove this, you break the whole application
    $locationProvider.html5Mode(true).hashPrefix('!');

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .factory('AuthorizationInterceptor', ['$rootScope', '$q', 'ipCookie', '$location', function ($rootScope, $q, ipCookie, $location) {

    //
    // Before we do anything else we should check to make sure
    // the users is authenticated with the CommonsCloud, otherwise
    // the this Client Application will not work properly. We must
    // have already authenticated the user (Resource Owner) with
    // the API through OAuth 2.0
    //
    // We set the default value to `false` and then check if the
    // session cookie for our domain exists.
    //
    $rootScope.user = {
      'is_authenticated': false
    };


    return {
      request: function(config) {
        var sessionCookie = ipCookie('ccapi_session');

        if (config.url !== '/views/authorize.html' && (sessionCookie === 'undefined' || sessionCookie === undefined)) {
          $location.hash('');
          $location.path('/');
          return config || $q.when(config);
        }

        config.headers = config.headers || {};
        if (sessionCookie) {
          config.headers.Authorization = 'Bearer ' + sessionCookie;
        }
        config.headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate';
        // config.headers['Content-Type'] = 'application/json';
        console.debug('AuthorizationInterceptor::Request', config || $q.when(config));
        return config || $q.when(config);
      },
      response: function(response) {
        if (response.status === 401 || response.status === 403) {
          $location.hash('');
          $location.path('/');
          return response || $q.when(response);
        }
        console.debug('AuthorizationInterceptor::Response', response || $q.when(response));
        return response || $q.when(response);
      }
    };

  }]).config(function ($httpProvider) {
    $httpProvider.interceptors.push('AuthorizationInterceptor');
  });
'use strict';

angular.module('commonsCloudAdminApp')
  .factory('CommonsCloudAPI', function ($http) {
    // Service logic
    // ...

    var meaningOfLife = 42;

    // Public API here
    return {
      getApplications: function () {
        
        return true;
      }
    };
  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Template', function () {

    this.$get = ['$resource', function ($resource) {

      var Template = $resource('//api.commonscloud.org/v2/templates/:templateId.json', {

      }, {
        get: {
          method: 'GET',
          url: '//api.commonscloud.org/v2/templates/:templateId.json'
        },
        query: {
          method: 'GET',
          isArray: true,
          url: '//api.commonscloud.org/v2/applications/:applicationId/templates.json',
          transformResponse: function (data, headersGetter) {

            var templates = angular.fromJson(data);

            return templates.response.templates;
          }
        },
        save: {
          method: 'POST',
          url: '//api.commonscloud.org/v2/applications/:applicationId/templates.json'
        },
        update: {
          method: 'PATCH'
        }
      });

      return Template;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Feature', function () {

    this.$get = ['$resource', function ($resource) {

      var Feature = $resource('//api.commonscloud.org/v2/:storage.json', {

      }, {
        query: {
          method: 'GET',
          isArray: false,
          transformResponse: function (data, headersGetter) {
            return angular.fromJson(data);
          }
        },
        postFiles: {
          method: 'PUT',
          url: '//api.commonscloud.org/v2/:storage/:featureId.json',
          transformRequest: angular.identity,
          headers: {
            'Content-Type': undefined
          }
        },
        get: {
          method: 'GET',
          url: '//api.commonscloud.org/v2/:storage/:featureId.json'
        },
        update: {
          method: 'PATCH',
          url: '//api.commonscloud.org/v2/:storage/:featureId.json'
        },
        delete: {
          method: 'DELETE',
          url: '//api.commonscloud.org/v2/:storage/:featureId.json'
        }
      });

      return Feature;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Field', function () {

    this.$get = ['$resource', function ($resource) {

      var Field = $resource('//api.commonscloud.org/v2/templates/:templateId/fields/:fieldId.json', {

      }, {
        query: {
          method: 'GET',
          isArray: true,
          url: '//api.commonscloud.org/v2/templates/:templateId/fields.json',
          transformResponse: function (data, headersGetter) {

            var fields = angular.fromJson(data);

            return fields.response.fields;
          }
        },
        save: {
          method: 'POST',
          url: '//api.commonscloud.org/v2/templates/:templateId/fields.json'
        },
        update: {
          method: 'PATCH'
        },
        delete: {
          method: 'DELETE',
          url: '//api.commonscloud.org/v2/templates/:templateId/fields/:fieldId.json'
        }

      });

      return Field;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Statistic', function () {

    this.$get = ['$resource', function ($resource) {

      var Statistic = $resource('//api.commonscloud.org/v2/templates/:templateId/statistics/:statisticId.json', {

      }, {
        get: {
          method: 'GET',
          transformResponse: function (data, headersGetter) {

            var statistic = angular.fromJson(data);

            return statistic.response;
          }

        },
        query: {
          method: 'GET',
          isArray: true,
          url: '//api.commonscloud.org/v2/templates/:templateId/statistics.json',
          transformResponse: function (data, headersGetter) {

            var statistics = angular.fromJson(data);

            return statistics.response.statistics;
          }
        },
        save: {
          method: 'POST',
          url: '//api.commonscloud.org/v2/templates/:templateId/statistics.json'
        },
        update: {
          method: 'PATCH'
        }
      });

      return Statistic;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('User', function() {

    this.$get = ['$resource', function($resource) {

      var User = $resource('//api.commonscloud.org/v2/user/me.json');

      return User;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Application', function() {

    this.$get = ['$resource', '$location', function($resource, $location) {

      var base_resource_url = '//api.commonscloud.org/v2/applications/:id.json';

      var Application = $resource(base_resource_url, {}, {
        query: {
          method: 'GET',
          isArray: true,
          transformResponse: function(data, headersGetter) {

            var applications = angular.fromJson(data);

            return applications.response.applications;
          }
        },
        update: {
          method: 'PATCH'
        }
      });

      return Application;
    }];
  });

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('IndexCtrl', ['$rootScope', '$scope', 'ipCookie', '$location', '$window', 'User', function($rootScope, $scope, ipCookie, $location, $window, User) {

    var host = $location.host(),
        redirect_uri;
    var session_cookie = ipCookie('ccapi_session');

    //
    // Get the User object so that we can present them with profile and other
    // notification information
    //
    // @todo
    // Move this somewhere that we don't need to call it in every controller
    //
    $scope.GetUser = function() {
      User.get().$promise.then(function(response) {
        $rootScope.user = response.response;
      }, function (error) {
        //
        // Once the template has been updated successfully we should give the
        // user some on-screen feedback and then remove it from the screen after
        // a few seconds as not to confuse them or force them to reload the page
        // to dismiss the message
        //
        var alert = {
          'type': 'error',
          'title': 'Oops!',
          'details': 'Looks like your user information is missing in action. Try reloading the page or logging in again.'
        };

        $scope.alerts.push(alert);
      });
    };

    if (!session_cookie) {

      //
      // Redirect based on current enviornment
      //
      if (host === 'localhost' || host === '127.0.0.1') {
        redirect_uri = 'http://api.commonscloud.org/oauth/authorize?response_type=token&client_id=PGvNp0niToyRspXaaqx3PiQBMn66QXyAq5yrNHpz&redirect_uri=http%3A%2F%2F127.0.0.1%3A9000%2Fauthorize&scope=user applications';
      } else {
        redirect_uri = 'http://api.commonscloud.org/oauth/authorize?response_type=token&client_id=MbanCzYpm0fUW8md1cdSJjUoYI78zTbak2XhZ2hF&redirect_uri=http%3A%2F%2Fapp.commonscloud.org%2Fauthorize&scope=user applications';
      }

      $window.location.href = redirect_uri;

    } else {
      $scope.GetUser();
      $location.hash('');
      $location.path('/applications');
    }

  }]);

'use strict';

angular.module('commonsCloudAdminApp').controller('AuthorizeCtrl', ['$scope', '$rootScope', '$location', 'ipCookie', function($scope, $rootScope, $location, ipCookie) {

    $scope.getAccessToken = function() {

      var locationHash = $location.hash();
      var accessToken = locationHash.substring(0, locationHash.indexOf('&'));
      var cleanToken = accessToken.replace('access_token=', '');

      var cookieOptions = {
        path: '/',
        expires: 2
      };

      $rootScope.user.is_authenticated = true;
      return ipCookie('ccapi_session', cleanToken, cookieOptions);
    };

    $scope.getAccessToken();

    $location.hash('');
    $location.path('/applications');
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('ApplicationsCtrl', ['$rootScope', '$scope', 'Application', function ($rootScope, $scope, Application) {

    //
    // Get a list of all Applications the user has access to
    //
    $scope.applications = Application.query();

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': 'active'
      }
    ];

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('ApplicationCtrl', ['$rootScope', '$scope', '$routeParams', 'Application', 'Template', 'Feature', function ($rootScope, $scope, $routeParams, Application, Template, Feature) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our existing content
    //
    $scope.application = {};
    $scope.templates = [];
    $scope.template = {};
    $scope.features = [];

    $scope.loading = true;

    //
    // Ensure the Templates are sorted oldest to newest
    //
    $scope.orderByField = 'id';
    $scope.reverseSort = false;

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    //
    // Default query parameters
    //
    $scope.query_params = {
      'order_by': [
        {
          'field': 'created',
          'direction': 'desc'
        }
      ]
    };


  //
  // CONTENT
  //
    $scope.GetTemplateList = function() {
      //
      // Get a list of templates associated with the current application
      //
      Template.query({
          applicationId: $routeParams.applicationId
        }).$promise.then(function(response) {
          $scope.templates = response;

          angular.forEach($scope.templates, function(template, index) {

            $scope.templates[index].features = [];

            //
            // Get a list of all features
            //
            Feature.query({
                storage: template.storage
              }).$promise.then(function(response) {
                $scope.templates[index].features = response;
              });

            //
            // Get a list of Features awaiting moderation
            //
            Feature.query({
                storage: template.storage,
                q: {
                  'filters': [
                    {
                      'name': 'status',
                      'op': 'eq',
                      'val': 'crowd'
                    }
                  ]
                }
              }).$promise.then(function(response) {
                $scope.templates[index].moderation = response;
                if ($scope.templates[index].moderation.properties.total_features > 0) {
                  $scope.templates[index].moderation = true;
                }
              });

          });

        });
    };

    //
    // Get the application the user has selected and begin loading the rest of
    // the application page
    //
    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': 'active'
          });

          //
          // Get a list of Templates belonging to this Application
          //
          $scope.GetTemplateList();

        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };

    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('ApplicationCreateCtrl', ['$rootScope', '$scope', 'Application', '$location', function ($rootScope, $scope, Application, $location) {

    //
    // Instantiate an Application object so that we can perform all necessary
    // functionality against our Application resource
    //
    $scope.application = new Application();
    $scope.applications = Application.query();

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': 'active'
      }
    ];

    //
    // Save a new Application to the API Database
    //
    $scope.save = function () {

      //
      // Save the Application via a post to the API and then push it onto the
      // Applications array, so that it appears in the user interface
      //
      $scope.application.$save().then(function (response) {
        $scope.applications.push(response.response);

        var alert = {
          'type': 'success',
          'title': 'Sweet!',
          'details': 'Your new Application was created, go add some stuff to it.'
        };

        $rootScope.alerts.push(alert);
        $location.path('/applications');

      }, function (error) {
        //
        // Once the template has been updated successfully we should give the
        // user some on-screen feedback and then remove it from the screen after
        // a few seconds as not to confuse them or force them to reload the page
        // to dismiss the message
        //
        var alert = {
          'type': 'error',
          'title': 'Oops!',
          'details': 'Looks like we couldn\'t create that Application, mind trying again?'
        };

        $scope.alerts.push(alert);
      });

    };

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('ApplicationEditCtrl', ['$route', '$rootScope', '$scope', '$routeParams', '$location', 'Application', 'User', function ($route, $rootScope, $scope, $routeParams, $location, Application, User) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our existing content
    //
    $scope.application = {};

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];
    $scope.loading = true;
    $rootScope.navigation = false;
    $scope.EditApplication = false;


  //
  // CONTENT
  //
    //
    // Get the application the user has selected and begin loading the rest of
    // the application page
    //
    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          $scope.application = response.response;
          $scope.loading = false;

          //
          // Get the User's information
          //
          $scope.GetUser();

        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };

    //
    // Save a new Application to the API Database
    //
    $scope.UpdateApplication = function () {

      if ($scope.application.id) {
        $scope.EditApplication = false;
        Application.update({
          id: $scope.application.id
        }, $scope.application).$promise.then(function(response) {
          $rootScope.alerts.push({
            'type': 'success',
            'title': 'Awesome!',
            'details': 'We saved your Application updates for you.'
          });
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind trying that again? It looks like we couldn\'t save those Application updates for you.'
          });
        });
      }

    };

    //
    // Delete an existing Application from the API Database
    //
    $scope.DeleteApplication = function (application) {

      //
      // Construct an object containing only the Application ID so that we
      // aren't sending along Application parameters in the URL
      //
      var application_ = {
        id: application.id
      };

      //
      // Send the 'DELETE' method to the API so it's removed from the database
      //
      Application.delete({
        id: application_.id
      }, application_).$promise.then(function(response) {
        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Deleted!',
          'details': 'Your Application was deleted successfully!'
        });

        $location.path('/applications');
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t delete that Application for you.'
        });
      });

    };


    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('TemplateCtrl', ['$rootScope', function ($rootScope) {

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('TemplateCreateCtrl', ['$rootScope', '$routeParams', '$scope', 'Application', 'Template', '$location', function ($rootScope, $routeParams, $scope, Application, Template, $location) {

    //
    // Instantiate an Application object so that we can perform all necessary
    // functionality against our Application resource
    //
    $scope.application = {};
    $scope.newTemplate = new Template();

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    //
    // Get the application the user has selected and begin loading the rest of
    // the application page
    //
    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'New',
            'title': '',
            'url': '/applications/' + $scope.application.id + '/collections/new',
            'class': 'active'
          });

        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };

    $scope.GetApplication();

    //
    // Create a new Template that does not yet exist in the API database
    //
    $scope.CreateTemplate = function() {
      $scope.newTemplate.$save({
        applicationId: $scope.application.id
      }).then(function(response) {
        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Great!',
          'details': 'We built that Template for you, now add some Fields to it.'
        });

        $location.path('/applications/' + $scope.application.id);
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t save that Template for you.'
        });
      });
    };

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('TemplateEditCtrl', ['$rootScope', '$routeParams', '$scope', 'Application', 'Template', '$location', function ($rootScope, $routeParams, $scope, Application, Template, $location) {

    //
    // Instantiate an Application object so that we can perform all necessary
    // functionality against our Application resource
    //
    $scope.application = {};
    $scope.template = {};

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    //
    // Get the application the user has selected and begin loading the rest of
    // the application page
    //
    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          if ($routeParams.templateId) {
            $scope.GetTemplate($routeParams.templateId);
          }

        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };


    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: template_id
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Edit ' + $scope.template.name,
            'title': 'Edit ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/settings',
            'class': 'active'
          });

        });
    };


    //
    // Update the attributes of an existing Template
    //
    $scope.UpdateTemplate = function() {
      Template.update({
        templateId: $scope.template.id
      }, $scope.template).$promise.then(function(response) {
        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Updated',
          'details': 'Your template updates were saved successfully!'
        });
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t update that Template for you.'
        });
      });

    };

    $scope.GetApplication();

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('TemplateDevCtrl', ['$rootScope', '$routeParams', '$scope', 'Application', 'Template', '$location', function ($rootScope, $routeParams, $scope, Application, Template, $location) {

    //
    // Instantiate an Application object so that we can perform all necessary
    // functionality against our Application resource
    //
    $scope.application = {};
    $scope.template = {};

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    //
    // Get the application the user has selected and begin loading the rest of
    // the application page
    //
    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          if ($routeParams.templateId) {
            $scope.GetTemplate($routeParams.templateId);
          }

        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };


    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: template_id
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Developer',
            'title': 'Developer',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/developers',
            'class': 'active'
          });

        });
    };


    $scope.GetApplication();

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('CollaboratorsCtrl', ['$rootScope', '$scope', '$routeParams', 'Application', function ($rootScope, $scope, $routeParams, Application) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our existing content
    //
    $scope.application = {};

    $scope.loading = true;

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];


  //
  // CONTENT
  //

    //
    // Get the application the user has selected and begin loading the rest of
    // the application page
    //
    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Collaborators',
            'title': 'View all of ' + $scope.application.name + '\'s collaborators',
            'url': '/applications/' + $scope.application.id + '/collaborators',
            'class': 'active'
          });

        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };

    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FeaturesCtrl', ['$rootScope', '$scope', '$routeParams', 'Application', 'Template', 'Feature', 'Field', function ($rootScope, $scope, $routeParams, Application, Template, Feature, Field) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.features = [];
    $scope.fields = [];

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];
    $scope.orderByField = null;
    $scope.reverseSort = false;

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    //
    // Default query parameters
    //
    $scope.query_params = {
      'order_by': [
        {
          'field': 'id',
          'direction': 'desc'
        }
      ]
    };

  //
  // CONTENT
  //
    $scope.GetFeatures = function(page) {
      Feature.query({
          storage: $scope.template.storage,
          page: page,
          q: $scope.query_params
        }).$promise.then(function(response) {
          $scope.featureproperties = response.properties;
          $scope.features = response.response.features;
        });
    };

    $scope.GetFields = function() {
      Field.query({
          templateId: $scope.template.id
        }).$promise.then(function(response) {
          $scope.fields = response;
        });
    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: $routeParams.templateId
        }).$promise.then(function(response) {
          $scope.template = response.response;

          if ($routeParams.page) {
            $scope.GetFeatures($routeParams.page);
          } else {
            $scope.GetFeatures(1);
          }

          $scope.GetFields();

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Features',
            'title': 'Viewing all features in ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/features',
            'class': 'active'
          });

        });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.GetTemplate();
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };


    //
    // Update how Features are sorted based on Field/Header clicked and
    // react to a second click by inverting the order
    //
    $scope.ChangeOrder = function (value) {
      $scope.orderByField = value;
      $scope.reverseSort =! $scope.reverseSort;
    };


    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FeatureCreateCtrl', ['$rootScope', '$scope', '$routeParams', '$window', '$timeout', '$location', 'Application', 'Template', 'Feature', 'Field', 'geolocation', 'leafletData', function ($rootScope, $scope, $routeParams, $window, $timeout, $location, Application, Template, Feature, Field, geolocation, leafletData) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.features = [];
    $scope.fields = [];
    $scope.feature = new Feature();
    $scope.files = [];
    $scope.feature.status = 'public';
    $scope.default_geometry = {};

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];
    $scope.ShowMap = true;


    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    //
    // Default query parameters
    //
    $scope.query_params = {
      'order_by': [
        {
          'field': 'id',
          'direction': 'desc'
        }
      ]
    };

    //
    // Default Map parameters and necessary variables
    //
    var featureGroup = new L.FeatureGroup();

    $scope.defaults = {
      tileLayer: 'https://{s}.tiles.mapbox.com/v3/developedsimple.hl46o07c/{z}/{x}/{y}.png',
      scrollWheelZoom: false
    };

    $scope.controls = {
      draw: {
        options: {
          draw: {
            circle: false,
            rectangle: false,
            polyline: {
              shapeOptions: {
                stroke: true,
                color: '#ffffff',
                weight: 4,
                opacity: 0.5,
                fill: true,
                fillColor: null,
                fillOpacity: 0.2,
                clickable: true
              }
            },
            polygon: {
              shapeOptions: {
                stroke: true,
                color: '#ffffff',
                weight: 4,
                opacity: 0.5,
                fill: true,
                fillColor: '#ffffff',
                fillOpacity: 0.2,
                clickable: true
              }
            },
            handlers: {
              marker: {
                tooltip: {
                  start: 'Click map to place marker.'
                }
              },
              polygon: {
                tooltip: {
                  start: 'Click to start drawing shape.',
                  cont: 'Click to continue drawing shape.',
                  end: 'Click first point to close this shape.'
                }
              },
              polyline: {
                error: '<strong>Error:</strong> shape edges cannot cross!',
                tooltip: {
                  start: 'Click to start drawing line.',
                  cont: 'Click to continue drawing line.',
                  end: 'Click last point to finish line.'
                }
              },
              simpleshape: {
                tooltip: {
                  end: 'Release mouse to finish drawing.'
                }
              }
            }
          },
          edit: {
            selectedPathOptions: {
              color: '#ffffff',
              opacity: 0.6,
              dashArray: '10, 10',
              fill: true,
              fillColor: '#ffffff',
              fillOpacity: 0.1
            },
            'featureGroup': featureGroup,
            'remove': true,
            handlers: {
              edit: {
                tooltip: {
                  text: 'Drag handles, or marker to edit feature.',
                  subtext: 'Click cancel to undo changes.'
                }
              },
              remove: {
                tooltip: {
                  text: 'Click on a feature to remove'
                }
              }
            }
          }
        }
      }
    };

  //
  // CONTENT
  //
    $scope.GetFields = function() {
      Field.query({
          templateId: $scope.template.id
        }).$promise.then(function(response) {
          $scope.fields = response;

          $scope.getEnumeratedValues($scope.fields);

          $scope.getEditableMap();
        });
    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: $routeParams.templateId
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.GetFields();

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Features',
            'title': 'Viewing all features in ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/features',
            'class': 'active'
          });

        });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.GetTemplate();
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };

    $scope.getCurrentLocation = function () {
      geolocation.getLocation().then(function(data){
        $scope.default_geometry = {
          "type": "Point",
          "coordinates": [
            data.coords.longitude,
            data.coords.latitude
          ]
        };
      });
    };


    $scope.getEditableMap = function () {

      leafletData.getMap().then(function(map) {

        $scope.$watch('default_geometry', function() {
          if ($scope.default_geometry.hasOwnProperty('coordinates')) {
            map.setView([$scope.default_geometry.coordinates[1], $scope.default_geometry.coordinates[0]], 13);
          }
        });

        // var featureGroup = new L.FeatureGroup();
        map.addLayer(featureGroup);

        //
        // On Drawing Complete add it to our FeatureGroup
        //
        map.on('draw:created', function (e) {
          var newLayer = e.layer;
          featureGroup.addLayer(newLayer);

          $scope.feature.geometry = JSON.stringify(featureGroup.toGeoJSON());
        });

        map.on('draw:edited', function (e) {
          var editedLayers = e.layers;
          editedLayers.eachLayer(function (layer) {
            featureGroup.addLayer(layer);
          });

          $scope.feature.geometry = JSON.stringify(featureGroup.toGeoJSON());
        });

        map.on('draw:deleted', function (e) {
          var deletedLayers = e.layers;
          deletedLayers.eachLayer(function (layer) {
            featureGroup.removeLayer(layer);
          });

          $scope.feature.geometry = JSON.stringify(featureGroup.toGeoJSON());
        });

        //
        // We need to invalidate the size of the Mapbox container so that it
        // displays properly. This is annoying and ugly ... timeouts are evil.
        // However, it serves as a temporary solution until we can figure out
        // something better.
        //
        $timeout(function () {
          map.invalidateSize();
        }, 500);
        
      });

      $scope.MapLoaded = true;
    };


    $scope.geojsonToLayer = function (geojson, layer) {
      layer.clearLayers();
      function add(l) {
        l.addTo(layer);
      }
      L.geoJson(geojson).eachLayer(add);
    };

    //
    // Build enumerated values for drop downs
    //
    $scope.getEnumeratedValues = function (field_list) {

      angular.forEach(field_list, function (field_, index) {
        if (field_.data_type === 'relationship') {
          Feature.query({
              storage: field_.relationship
            }).$promise.then(function (response) {
              $scope.fields[index].values = response.response.features;
            }, function(error) {
              $rootScope.alerts.push({
                'type': 'error',
                'title': 'Uh-oh!',
                'details': 'Something stranged happened, please reload the page.'
              });
            });
        }
      });

    };

    //
    // Convert a FeatureCollection to a GeometryCollection so that it can be
    // saved to a Geometry field within the CommonsCloud API
    //
    $scope.convertFeatureCollectionToGeometryCollection = function (featureCollection) {

      var ExistingCollection = angular.fromJson(featureCollection);

      var NewFeatureCollection = {
        'type': 'GeometryCollection',
        'geometries': []
      };

      angular.forEach(ExistingCollection.features, function (feature, index) {
        NewFeatureCollection.geometries.push(feature.geometry);
      });

      return NewFeatureCollection;
    };

    //
    // Convert a GeometryCollection to a FeatureCollection so that it can be
    // saved to a Geometry field within the CommonsCloud Admin UI
    //
    $scope.convertGeometryCollectionToFeatureCollection = function (geometryCollection) {

      var ExistingCollection = angular.fromJson(geometryCollection);

      var NewFeatureCollection = {
        'type': 'FeatureCollection',
        'features': []
      };

      angular.forEach(ExistingCollection.geometries, function (feature, index) {
        var geometry_ = {
          'type': 'Feature',
          'geometry': feature
        };

        NewFeatureCollection.features.push(geometry_);
      });

      return NewFeatureCollection;
    };

    $scope.CreateFeature = function () {

      if ($scope.feature.geometry) {
        var geometry_object = $scope.convertFeatureCollectionToGeometryCollection($scope.feature.geometry);
        $scope.feature.geometry = JSON.stringify(geometry_object);
      }

      angular.forEach($scope.fields, function(field, index) {
        if (field.data_type === 'relationship') {
          if (angular.isArray($scope.feature[field.relationship]) && $scope.feature[field.relationship].length >= 1) {
            
            var relationship_array_ = [];

            angular.forEach($scope.feature[field.relationship], function (value, index) {
              relationship_array_.push({
                'id': value
              });
            });

            $scope.feature[field.relationship] = relationship_array_;
          } else if (angular.isNumber($scope.feature[field.relationship])) {

            var value = $scope.feature[field.relationship];

            $scope.feature[field.relationship] = [{
              'id': value
            }];

          }
        }
      });

      $scope.feature.$save({
        storage: $scope.template.storage
      }).then(function(response) {

        var fileData = new FormData();

        angular.forEach($scope.files, function(file, index) {
          fileData.append(file.field, file.file)
        });

        Feature.postFiles({
          storage: $scope.template.storage,
          featureId: response.resource_id
        }, fileData).$promise.then(function(response) {
          console.log('Update fired', response);
        }, function(error) {
          console.log('Update failed!!!!', error);
        });

        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Yes!',
          'details': 'Your new Features created.'
        });

        $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/features');
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t create that Feature for you.'
        });
      });
    };


    $scope.onFileRemove = function(file, index) {
      $scope.files.splice(index, 1);
    };

    $scope.onFileSelect = function(files, field_name) {

      console.log('field_name', field_name);

      angular.forEach(files, function(file, index) {
        // Check to see if we can load previews
        if (window.FileReader && file.type.indexOf('image') > -1) {

          var fileReader = new FileReader();
          fileReader.readAsDataURL(file);
          fileReader.onload = function (event) {
            file.preview = event.target.result;
            $scope.files.push({
              'field': field_name,
              'file': file
            });
            $scope.$apply();
            console.log('files', $scope.files);
          };
        } else {
          $scope.files.push({
            'field': field_name,
            'file': file
          });
          $scope.$apply();
          console.log('files', $scope.files);
        }
      });

    };

    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FeatureEditCtrl', ['$rootScope', '$scope', '$route', '$routeParams', '$window', '$timeout', '$location', '$http', 'Application', 'Template', 'Feature', 'Field', 'geolocation', 'leafletData', function ($rootScope, $scope, $route, $routeParams, $window, $timeout, $location, $http, Application, Template, Feature, Field, geolocation, leafletData) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.fields = [];
    $scope.feature = {};
    $scope.files = [];
    $scope.default_geometry = {};

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];
    $scope.ShowMap = true;


    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    //
    // Default query parameters
    //
    $scope.query_params = {
      'order_by': [
        {
          'field': 'id',
          'direction': 'desc'
        }
      ]
    };

    //
    // Default Map parameters and necessary variables
    //
    var featureGroup = new L.FeatureGroup();

    $scope.defaults = {
      tileLayer: 'https://{s}.tiles.mapbox.com/v3/developedsimple.hl46o07c/{z}/{x}/{y}.png',
      scrollWheelZoom: false
    };

    $scope.controls = {
      draw: {
        options: {
          draw: {
            circle: false,
            rectangle: false,
            polyline: {
              shapeOptions: {
                stroke: true,
                color: '#ffffff',
                weight: 4,
                opacity: 0.5,
                fill: true,
                fillColor: null,
                fillOpacity: 0.2,
                clickable: true
              }
            },
            polygon: {
              shapeOptions: {
                stroke: true,
                color: '#ffffff',
                weight: 4,
                opacity: 0.5,
                fill: true,
                fillColor: '#ffffff',
                fillOpacity: 0.2,
                clickable: true
              }
            },
            handlers: {
              marker: {
                tooltip: {
                  start: 'Click map to place marker.'
                }
              },
              polygon: {
                tooltip: {
                  start: 'Click to start drawing shape.',
                  cont: 'Click to continue drawing shape.',
                  end: 'Click first point to close this shape.'
                }
              },
              polyline: {
                error: '<strong>Error:</strong> shape edges cannot cross!',
                tooltip: {
                  start: 'Click to start drawing line.',
                  cont: 'Click to continue drawing line.',
                  end: 'Click last point to finish line.'
                }
              },
              simpleshape: {
                tooltip: {
                  end: 'Release mouse to finish drawing.'
                }
              }
            }
          },
          edit: {
            selectedPathOptions: {
              color: '#ffffff',
              opacity: 0.6,
              dashArray: '10, 10',
              fill: true,
              fillColor: '#ffffff',
              fillOpacity: 0.1
            },
            'featureGroup': featureGroup,
            'remove': true,
            handlers: {
              edit: {
                tooltip: {
                  text: 'Drag handles, or marker to edit feature.',
                  subtext: 'Click cancel to undo changes.'
                }
              },
              remove: {
                tooltip: {
                  text: 'Click on a feature to remove'
                }
              }
            }
          }
        }
      }
    };

  //
  // CONTENT
  //
    $scope.GetFeature = function(feature_id) {

      Feature.get({
          storage: $scope.template.storage,
          featureId: feature_id
        }).$promise.then(function(response) {
          $scope.feature = response.response;
          $scope.default_geometry = $scope.feature.geometry;
          $scope.getEnumeratedValues($scope.fields);
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind trying that again? We couldn\'t find the Feature you were looking for.'
          });

          $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/features');
        });

    };

    $scope.GetFields = function() {
      Field.query({
          templateId: $scope.template.id
        }).$promise.then(function(response) {
          $scope.fields = response;

          if ($routeParams.featureId) {
            $scope.GetFeature($routeParams.featureId);
            $scope.getEditableMap();
          }
        });
    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: $routeParams.templateId
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.GetFields();

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Features',
            'title': 'Viewing all features in ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/features',
            'class': 'active'
          });

        });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.GetTemplate();
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };

    $scope.getCurrentLocation = function () {
      geolocation.getLocation().then(function(data){
        $scope.default_geometry = {
          "type": "Point",
          "coordinates": [
            data.coords.longitude,
            data.coords.latitude
          ]
        };
      });
    };


    $scope.getEditableMap = function () {

      leafletData.getMap().then(function(map) {

        $scope.$watch('default_geometry', function() {
          if ((!angular.isUndefined($scope.default_geometry)) && ($scope.default_geometry !== null) && ($scope.default_geometry.hasOwnProperty('coordinates'))) {
            map.setView([$scope.default_geometry.coordinates[1], $scope.default_geometry.coordinates[0]], 13);
          } else if (($scope.feature !== null) && ($scope.feature.hasOwnProperty('geometry'))) {
            $scope.feature.geometry = $scope.convertGeometryCollectionToFeatureCollection($scope.feature.geometry);

            if ($scope.feature.geometry !== undefined) {

              $scope.geojsonToLayer($scope.feature.geometry, featureGroup);
              map.fitBounds(featureGroup.getBounds());
            }
          }
        });

        // var featureGroup = new L.FeatureGroup();
        map.addLayer(featureGroup);

        //
        // On Drawing Complete add it to our FeatureGroup
        //
        map.on('draw:created', function (e) {
          var newLayer = e.layer;
          featureGroup.addLayer(newLayer);

          $scope.feature.geometry = JSON.stringify(featureGroup.toGeoJSON());
        });

        map.on('draw:edited', function (e) {
          var editedLayers = e.layers;
          editedLayers.eachLayer(function (layer) {
            featureGroup.addLayer(layer);
          });

          $scope.feature.geometry = JSON.stringify(featureGroup.toGeoJSON());
        });

        map.on('draw:deleted', function (e) {
          var deletedLayers = e.layers;
          deletedLayers.eachLayer(function (layer) {
            featureGroup.removeLayer(layer);
          });

          $scope.feature.geometry = JSON.stringify(featureGroup.toGeoJSON());
        });

        //
        // We need to invalidate the size of the Mapbox container so that it
        // displays properly. This is annoying and ugly ... timeouts are evil.
        // However, it serves as a temporary solution until we can figure out
        // something better.
        //
        $timeout(function () {
          map.invalidateSize();
        }, 500);
        
      });

      $scope.MapLoaded = true;
    };


    $scope.geojsonToLayer = function (geojson, layer) {
      layer.clearLayers();
      function add(l) {
        l.addTo(layer);
      }
      L.geoJson(geojson).eachLayer(add);
    };

    //
    // Build enumerated values for drop downs
    //
    $scope.getEnumeratedValues = function (field_list) {

      angular.forEach(field_list, function (field_, index) {
        if (field_.data_type === 'relationship') {
          Feature.query({
              storage: field_.relationship
            }).$promise.then(function (response) {
              $scope.fields[index].values = response.response.features;

              var default_values = [];

              angular.forEach($scope.feature[field_.relationship], function (feature, index) {
                default_values.push(feature.id);
              });

              $scope.feature[field_.relationship] = default_values;

            }, function(error) {
              $rootScope.alerts.push({
                'type': 'error',
                'title': 'Uh-oh!',
                'details': 'Something stranged happened, please reload the page.'
              });
            });
        }
      });

    };

    //
    // Convert a FeatureCollection to a GeometryCollection so that it can be
    // saved to a Geometry field within the CommonsCloud API
    //
    $scope.convertFeatureCollectionToGeometryCollection = function (featureCollection) {

      var ExistingCollection = angular.fromJson(featureCollection);

      var NewFeatureCollection = {
        'type': 'GeometryCollection',
        'geometries': []
      };

      angular.forEach(ExistingCollection.features, function (feature, index) {
        NewFeatureCollection.geometries.push(feature.geometry);
      });

      return NewFeatureCollection;
    };

    //
    // Convert a GeometryCollection to a FeatureCollection so that it can be
    // saved to a Geometry field within the CommonsCloud Admin UI
    //
    $scope.convertGeometryCollectionToFeatureCollection = function (geometryCollection) {

      var ExistingCollection = angular.fromJson(geometryCollection);

      var NewFeatureCollection = {
        'type': 'FeatureCollection',
        'features': []
      };

      if (ExistingCollection !== null && ExistingCollection !== undefined) {
        angular.forEach(ExistingCollection.geometries, function (feature, index) {
          var geometry_ = {
            'type': 'Feature',
            'geometry': feature
          };

          NewFeatureCollection.features.push(geometry_);
        });

        return NewFeatureCollection;
      }

    };


    //
    // Update the attributes of an existing Template
    //
    $scope.UpdateFeature = function () {

      if ($scope.feature.geometry) {
        $scope.feature.geometry = $scope.convertFeatureCollectionToGeometryCollection($scope.feature.geometry);
      }

      angular.forEach($scope.fields, function(field, index) {
        if (field.data_type === 'relationship') {
          if (angular.isArray($scope.feature[field.relationship]) && $scope.feature[field.relationship].length >= 1) {
            
            var relationship_array_ = [];

            angular.forEach($scope.feature[field.relationship], function (value, index) {
              relationship_array_.push({
                'id': value
              });
            });

            $scope.feature[field.relationship] = relationship_array_;
          } else if (angular.isNumber($scope.feature[field.relationship])) {

            var value = $scope.feature[field.relationship];

            $scope.feature[field.relationship] = [{
              'id': value
            }];

          }
        }
      });

      Feature.update({
        storage: $scope.template.storage,
        featureId: $scope.feature.id
      }, $scope.feature).$promise.then(function(response) {

        var fileData = new FormData();

        angular.forEach($scope.files, function(file, index) {
          fileData.append(file.field, file.file)
        });

        Feature.postFiles({
          storage: $scope.template.storage,
          featureId: $scope.feature.id
        }, fileData).$promise.then(function(response) {
          console.log('Update fired', response);
        }, function(error) {
          console.log('Update failed!!!!', error);
        });

        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Awesome!',
          'details': 'Your Feature updates were saved successfully!'
        });

        $route.reload();
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t update that Feature for you.'
        });
      });
    };

    //
    // Delete an existing Field from the API Database
    //
    $scope.DeleteFeature = function () {

      //
      // Send the 'DELETE' method to the API so it's removed from the database
      //
      Feature.delete({
        storage: $scope.template.storage,
        featureId: $scope.feature.id
      }).$promise.then(function(response) {
  
        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Awesome!',
          'details': 'Your Feature updates were saved successfully!'
        });

        $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/features');
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t update that Feature for you.'
        });
      });

    };

    $scope.onFileRemove = function(file, index) {
      console.log('Need to delete', file)
      // $scope.files.splice(index, 1);
    };

    $scope.onFileSelect = function(files, field_name) {

      console.log('field_name', field_name);

      angular.forEach(files, function(file, index) {
        // Check to see if we can load previews
        if (window.FileReader && file.type.indexOf('image') > -1) {

          var fileReader = new FileReader();
          fileReader.readAsDataURL(file);
          fileReader.onload = function (event) {
            file.preview = event.target.result;
            var new_file = {
              'field': field_name,
              'file': file
            };
            $scope.files.push(new_file);
            $scope.feature[field_name].push(new_file);
            $scope.$apply();
            console.log('files', $scope.files);
            console.log('$scope.feature[' + field_name + ']', $scope.feature[field_name]);
          };
        } else {
          var new_file = {
            'field': field_name,
            'file': file
          };
          $scope.files.push(new_file);
          $scope.feature[field_name].push(new_file);
          $scope.$apply();
          console.log('files', $scope.files);
          console.log('$scope.feature[' + field_name + ']', $scope.feature[field_name]);
        }
      });

    };


    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('StatisticsCtrl', ['$route', '$rootScope', '$scope', '$routeParams', '$location', 'Application', 'Template', 'Statistic', 'User', function ($route, $rootScope, $scope, $routeParams, $location, Application, Template, Statistic, User) {


  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.features = [];
    $scope.fields = [];
    $scope.statistics = [];

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];
    $scope.orderByField = null;
    $scope.reverseSort = false;

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: template_id
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Statistics',
            'title': 'Viewing all statistics for the ' + $scope.template.name + ' feature collection',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/statistics',
            'class': 'active'
          });

          //
          // Once we've returned the Template we can get the Statistics for it
          //
          Statistic.query({
            templateId: $scope.template.id
          }).$promise.then(function(response) {
            $scope.statistics = response;
          });
        });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          if ($routeParams.templateId) {
            $scope.GetTemplate($routeParams.templateId);
          }
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };
    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();

  }]);
'use strict';

angular.module('commonsCloudAdminApp')
  .controller('StatisticCreateCtrl', ['$route', '$rootScope', '$scope', '$routeParams', '$location', 'Application', 'Template', 'Field', 'Statistic', 'User', function ($route, $rootScope, $scope, $routeParams, $location, Application, Template, Field, Statistic, User) {


  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.features = [];
    $scope.fields = [];
    $scope.statistics = [];
    $scope.statistic = new Statistic();

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];
    $scope.orderByField = null;
    $scope.reverseSort = false;

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: template_id
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Statistics',
            'title': 'Viewing all statistics for the ' + $scope.template.name + ' feature collection',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/statistics',
            'class': 'active'
          });

          $scope.breadcrumbs.push({
            'label': 'Statistics',
            'title': 'Viewing all statistics for the ' + $scope.template.name + ' feature collection',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/statistics/new',
            'class': 'active'
          });

          $scope.GetFields();
        });
    };

    $scope.GetFields = function() {
      Field.query({
          templateId: $scope.template.id
        }).$promise.then(function(response) {
          $scope.fields = response;
        });
    };

    $scope.CreateStatistic = function (statistic) {
      $scope.statistic.$save({
        templateId: $routeParams.templateId
      }).then(function (response) {
        $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/statistics');
      });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          //
          // Return the requested Statistic after the Template is loaded
          //
          if ($routeParams.templateId) {
            $scope.GetTemplate($routeParams.templateId);
          }
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };
    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();

  }]);
'use strict';

angular.module('commonsCloudAdminApp')
  .controller('StatisticEditCtrl', ['$route', '$rootScope', '$scope', '$routeParams', '$location', 'Application', 'Template', 'Field', 'Statistic', 'User', function ($route, $rootScope, $scope, $routeParams, $location, Application, Template, Field, Statistic, User) {


  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.features = [];
    $scope.fields = [];
    $scope.statistics = [];
    $scope.statistic = {};

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];
    $scope.orderByField = null;
    $scope.reverseSort = false;

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: template_id
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Statistics',
            'title': 'Viewing all statistics for the ' + $scope.template.name + ' feature collection',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/statistics',
            'class': 'active'
          });

          $scope.breadcrumbs.push({
            'label': 'Statistics',
            'title': 'Viewing all statistics for the ' + $scope.template.name + ' feature collection',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/statistics/new',
            'class': 'active'
          });

          $scope.GetFields();

          //
          // Return the requested Statistic after the Template is loaded
          //
          if ($routeParams.statisticId) {
            $scope.GetStatistic($scope.template.id, $routeParams.statisticId);
          }
        });
    };

    $scope.GetFields = function() {
      Field.query({
          templateId: $scope.template.id
        }).$promise.then(function(response) {
          $scope.fields = response;
        });
    };

    $scope.GetStatistic = function(template_id, statistic_id) {
      Statistic.get({
        templateId: template_id,
        statisticId: statistic_id
      }).$promise.then(function (response) {
        $scope.statistic = response;
      });
    };

    $scope.UpdateStatistic = function (statistic) {
      Statistic.update({
          templateId: $scope.template.id,
          statisticId: statistic.id
        }, statistic).$promise.then(function(response) {
          $rootScope.alerts.push({
            'type': 'success',
            'title': 'Updated',
            'details': 'We saved the updates you made to your statistic!'
          });
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind trying that again? It looks like we couldn\'t save those Statistic updates.'
          });
        });
    };

    $scope.DeleteStatistic = function (statistic) {

      var statistic_ = {
        templateId: $scope.template.id,
        statisticId: statistic.id
      };

      //
      // Send the 'DELETE' method to the API so it's removed from the database
      //
      Statistic.delete(statistic_);

      //
      // Update the Statistics list so that it no longer displays the deleted
      // items
      //
      $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/statistics');
    };


    //
    // Get the single application that the user wants to view
    //
    Application.get({
        id: $routeParams.applicationId
      }).$promise.then(function(response) {

        //
        // Assign the response to the Application object and end loading
        //
        $scope.application = response.response;
        $scope.loading = false;

        //
        // Update the breadcrumbs based on the response from the application
        //
        $scope.breadcrumbs.push({
          'label': $scope.application.name,
          'title': 'View ' + $scope.application.name,
          'url': '/applications/' + $scope.application.id,
          'class': ''
        });

        $scope.breadcrumbs.push({
          'label': 'Feature Collections',
          'title': 'View all of ' + $scope.application.name + '\'s feature collections',
          'url': '/applications/' + $scope.application.id,
          'class': ''
        });

        //
        // Return the requested Statistic after the Template is loaded
        //
        if ($routeParams.templateId) {
          $scope.GetTemplate($routeParams.templateId);
        }
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
        });
      });
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FieldsCtrl', ['$rootScope', '$scope', '$routeParams', 'Application', 'Template', 'Field', '$location', '$anchorScroll', function ($rootScope, $scope, $routeParams, Application, Template, Field, $location, $anchorScroll) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.fields = [];


    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];


  //
  // CONTENT
  //
    $scope.GetFields = function() {
      Field.query({
          templateId: $scope.template.id
        }).$promise.then(function(response) {
          $scope.fields = response;
        });
    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: $routeParams.templateId
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.GetFields();

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Fields',
            'title': 'Viewing all field for ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields',
            'class': 'active'
          });

        });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.GetTemplate();
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };

    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FieldCreateCtrl', ['$rootScope', '$scope', '$routeParams', 'Application', 'Template', 'Field', '$location', function ($rootScope, $scope, $routeParams, Application, Template, Field, $location) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.templates = [];
    $scope.template = {};
    $scope.field = new Field();


    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];


  //
  // CONTENT
  //

    //
    // Get a list of templates for the relationship field type
    //
    $scope.GetTemplateList = function(application_id) {
      //
      // Get a list of templates associated with the current application
      //
      Template.query({
          applicationId: application_id
        }).$promise.then(function(response) {
          $scope.templates = response;
        });
    };
    //
    // Create a new Field that does not yet exist in the API database
    //
    $scope.CreateField = function () {


      console.log('$scope.field', $scope.field);

      $scope.field.$save({
        templateId: $scope.template.id
      }).then(function(response) {
        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Great!',
          'details': 'Your new Field was added to the Template.'
        });

        $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields');

      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t create that Field for you.'
        });
      });
    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: template_id
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Fields',
            'title': 'Viewing all fields for ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields',
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'New',
            'title': 'Create a new field',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields/new',
            'class': 'active'
          });

        });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          if ($routeParams.templateId) {
            $scope.GetTemplate($routeParams.templateId);            
          }

          if ($routeParams.applicationId) {
            $scope.GetTemplateList($routeParams.applicationId);            
          }
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };


    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FieldEditCtrl', ['$rootScope', '$scope', '$routeParams', 'Application', 'Template', 'Field', '$location', function ($rootScope, $scope, $routeParams, Application, Template, Field, $location) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = {};
    $scope.template = {};
    $scope.field = {};


    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    //
    // Define the Breadcrumbs that appear at the top of the page in the nav bar
    //
    $scope.breadcrumbs = [
      {
        'label': 'Applications',
        'title': 'View my applications',
        'url': '/applications',
        'class': ''
      }
    ];


  //
  // CONTENT
  //
    $scope.GetField = function(template_id, field_id) {
      Field.get({
          templateId: template_id,
          fieldId: field_id
        }).$promise.then(function(response) {
          $scope.field = response.response;

          $scope.breadcrumbs.push({
            'label': 'Edit',
            'title': 'Editing the ' + $scope.field.name + ' field',
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields/' + $scope.field.id + '/edit',
            'class': 'active'
          });
        });
    };

    //
    // Update the attributes of an existing Template
    //
    $scope.UpdateField = function () {
      Field.update({
        templateId: $scope.template.id,
        fieldId: $scope.field.id
      }, $scope.field).$promise.then(function(response) {

        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Updated!',
          'details': 'Your Field updates were saved successfully!'
        });

        $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields');

      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t update that Field for you.'
        });
      });
    };

    //
    // Delete an existing Field from the API Database
    //
    $scope.DeleteField = function (field) {

      //
      // Send the 'DELETE' method to the API so it's removed from the database
      //
      Field.delete({
        templateId: $scope.template.id,
        fieldId: field.id
      }, field).$promise.then(function(response) {
        $rootScope.alerts.push({
          'type': 'success',
          'title': '',
          'details': 'Your Field was deleted!'
        });

        $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields');
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t delete that Field for you.'
        });
      });

    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: $routeParams.templateId
        }).$promise.then(function(response) {
          $scope.template = response.response;

          $scope.breadcrumbs.push({
            'label': $scope.template.name,
            'title': 'View ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Fields',
            'title': 'Viewing all fields for ' + $scope.template.name,
            'url': '/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/fields',
            'class': ''
          });

          if ($routeParams.templateId && $routeParams.fieldId) {
            $scope.GetField($routeParams.templateId, $routeParams.fieldId);            
          }

        });
    };

    $scope.GetApplication = function() {
      //
      // Get the single application that the user wants to view
      //
      Application.get({
          id: $routeParams.applicationId
        }).$promise.then(function(response) {

          //
          // Assign the response to the Application object and end loading
          //
          $scope.application = response.response;
          $scope.loading = false;

          //
          // Update the breadcrumbs based on the response from the application
          //
          $scope.breadcrumbs.push({
            'label': $scope.application.name,
            'title': 'View ' + $scope.application.name,
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.breadcrumbs.push({
            'label': 'Feature Collections',
            'title': 'View all of ' + $scope.application.name + '\'s feature collections',
            'url': '/applications/' + $scope.application.id,
            'class': ''
          });

          $scope.GetTemplate();
        }, function(error) {
          $rootScope.alerts.push({
            'type': 'error',
            'title': 'Uh-oh!',
            'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
          });
        });
    };


    //
    // Now that we've got the everything prepared, let's go ahead and start
    // the controller by instantiating the GetApplication method
    //
    $scope.GetApplication();
  }]);
