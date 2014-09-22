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
    'ipCookie',
    'ngResource',
    'ngSanitize',
    'ngRoute',
    'ngAnimate',
    'ui.gravatar',
    'leaflet-directive',
    'angularFileUpload',
    'geolocation',
    'angular-loading-bar',
    'monospaced.elastic'
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
      .when('/logout', {
        templateUrl: '/views/logout.html',
        controller: 'LogoutCtrl'
      })
      .when('/applications', {
        templateUrl: '/views/applications.html',
        controller: 'ApplicationsCtrl',
        resolve: {
          applications: function(Application) {
            return Application.query();
          },
          user: function(User) {
            return User.getUser();
          }
        }
      })
      .when('/applications/new', {
        templateUrl: '/views/application-create.html',
        controller: 'ApplicationCreateCtrl',
        resolve: {
          user: function(User) {
            return User.getUser();
          }
        }
      })
      .when('/applications/:applicationId', {
        templateUrl: '/views/application.html',
        controller: 'ApplicationCtrl',
        resolve: {
          application: function(Application, $route) {
            return Application.GetApplication($route.current.params.applicationId);
          },
          templates: function(Template, $route) {
            return Template.GetTemplateList($route.current.params.applicationId);
          },
          user: function(User) {
            return User.getUser();
          }
        }
      })
      .when('/applications/:applicationId/edit', {
        templateUrl: '/views/application-edit.html',
        controller: 'ApplicationEditCtrl',
        resolve: {
          application: function(Application, $route) {
            return Application.GetApplication($route.current.params.applicationId);
          },
          user: function(User) {
            return User.getUser();
          }
        }
      })
      .when('/applications/:applicationId/collections', {
        redirectTo: '/applications/:applicationId'
      })
      .when('/applications/:applicationId/collaborators', {
        templateUrl: '/views/collaborators.html',
        controller: 'CollaboratorsCtrl',
        resolve: {
          application: function(Application, $route) {
            return Application.GetApplication($route.current.params.applicationId);
          },
          user: function(User) {
            return User.getUser();
          }
        }
      })
      .when('/applications/:applicationId/collections/new', {
        templateUrl: '/views/template-create.html',
        controller: 'TemplateCreateCtrl',
        resolve: {
          application: function(Application, $route) {
            return Application.GetApplication($route.current.params.applicationId);
          },
          user: function(User) {
            return User.getUser();
          }
        }
      })
      .when('/applications/:applicationId/collections/:templateId/features', {
        templateUrl: '/views/features.html',
        controller: 'FeaturesCtrl',
        resolve: {
          application: function(Application, $route) {
            return Application.GetApplication($route.current.params.applicationId);
          },
          template: function(Template, $route) {
            return Template.GetTemplate($route.current.params.templateId);
          },
          fields: function(Field, $route) {
            return Field.GetFields($route.current.params.templateId);
          },
          user: function(User) {
            return User.getUser();
          },
          features: function(Feature, $route) {
            return Feature.GetPaginatedFeatures($route.current.params.templateId, $route.current.params.page);
          }
        }
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
      .when('/applications/:applicationId/collections/:templateId/import', {
        templateUrl: '/views/template-import.html',
        controller: 'TemplateImportCtrl'
      // })
      // .otherwise({
      //   templateUrl: '/views/errors/404.html'
      });

    // If you remove this, you break the whole application
    $locationProvider.html5Mode(true).hashPrefix('!');

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .factory('AuthorizationInterceptor', ['$rootScope', '$q', 'ipCookie', '$location', function ($rootScope, $q, ipCookie, $location) {
    return {
      request: function(config) {

        if (config.headers.Authorization === 'external') {
          delete config.headers.Authorization;
          return config || $q.when(config);
        }

        var session_cookie = ipCookie('COMMONS_SESSION');

        if (config.url !== '/views/authorize.html' && (session_cookie === 'undefined' || session_cookie === undefined)) {
          $location.hash('');
          $location.path('/');
          return config || $q.when(config);
        }

        config.headers = config.headers || {};
        if (session_cookie) {
          config.headers.Authorization = 'Bearer ' + session_cookie;
        }

        config.headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate';
        console.debug('AuthorizationInterceptor::Request', config || $q.when(config));
        return config || $q.when(config);
      },
      response: function(response) {
        console.debug('AuthorizationInterceptor::Response', response || $q.when(response));
        return response || $q.when(response);
      },
      responseError: function (response) {
        if (response && (response.status === 401 || response === 403)) {
          console.error('Couldn\'t retrieve user information from server., need to redirect and clear cookies');

          var session_cookie = ipCookie('COMMONS_SESSION');

          if (session_cookie && session_cookie !== undefined && session_cookie !== 'undefined') {
            //
            // Clear out existing COMMONS_SESSION cookies that may be invalid or
            // expired. This may happen when a user closes the window and comes back
            //
            ipCookie.remove('COMMONS_SESSION');
            ipCookie.remove('COMMONS_SESSION', { path: '/' });

            //
            // Start a new Alerts array that is empty, this clears out any previous
            // messages that may have been presented on another page
            //
            $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

            $rootScope.alerts.push({
              'type': 'info',
              'title': 'Please sign in again',
              'details': 'You may only sign in at one location at a time'
            });


            $location.hash('');
            $location.path('/');
          }
        }
        if (response && response.status >= 500) {
          console.log('ResponseError', response);
        }
        return $q.reject(response);
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
        activity: {
          method: 'GET',
          url: '//api.commonscloud.org/v2/templates/:templateId/activity.json'
        },
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

      Template.GetTemplate = function(templateId) {
  
        var promise = Template.get({
            templateId: templateId,
            updated: new Date().getTime()
          }).$promise.then(function(response) {
            return response.response;
          });

        return promise;
      };

      Template.GetTemplateList = function(applicationId) {
        
        //
        // Get a list of templates associated with the current application
        //
        var promise = Template.query({
            applicationId: applicationId,
            updated: new Date().getTime()
          }).$promise.then(function(response) {
            return response;
          });

        return promise;
      };


      return Template;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Feature', function () {

    this.$get = ['$resource', 'Template', function ($resource, Template) {

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

      Feature.GetPaginatedFeatures = function(templateId, page) {
        
        var promise = Feature.GetTemplate(templateId, page).then(function(options) {
          return Feature.GetFeatures(options);
        });
        
        return promise;     
      }

      Feature.GetTemplate = function(templateId, page) {

        console.log(page);
  
        var promise = Template.get({
            templateId: templateId,
            updated: new Date().getTime()
          }).$promise.then(function(response) {
            return {
              storage: response.response.storage,
              page: page
            };
          });

        return promise;
      };

      Feature.GetFeatures = function(options) {

        console.log('options', options);

        var promise = Feature.query({
            storage: options.storage,
            page: (options.page === undefined || options.page === null) ? 1: options.page,
            q: {
              'order_by': [
                {
                  'field': 'id',
                  'direction': 'desc'
                }
              ]
            },
            updated: new Date().getTime()
          }).$promise.then(function(response) {
            console.log('response', response);
            return response;
          });

        return promise;
      };

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

      Field.GetFields = function(templateId) {

        var promise = Field.query({
            templateId: templateId,
            updated: new Date().getTime()
          }).$promise.then(function(response) {
            return response;
          });

        return promise
      };

      return Field;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Attachment', function () {

    this.$get = ['$resource', function ($resource) {

      var Attachment = $resource('//api.commonscloud.org/v2/:storage/:featureId/:attachmentStorage/:attachmentId.json', {

      }, {
        delete: {
          method: 'DELETE'
        }
      });

      return Attachment;
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

    this.$get = ['$resource', '$rootScope', '$location', '$q', 'ipCookie', '$timeout', function($resource, $rootScope, $location, $q, ipCookie, $timeout) {

      var User = $resource('//api.commonscloud.org/v2/user/me.json');

      User.getUser = function () {

        var promise = User.get().$promise.then(function(response) {
          $rootScope.user = response.response;
          return response.response;
        }, function (response) {

          if (response.status === 401 || response.status === 403) {
            console.error('Couldn\'t retrieve user information from server., need to redirect and clear cookies');

            var session_cookie = ipCookie('COMMONS_SESSION');

            if (session_cookie && session_cookie !== undefined && session_cookie !== 'undefined') {
              //
              // Clear out existing COMMONS_SESSION cookies that may be invalid or
              // expired. This may happen when a user closes the window and comes back
              //
              ipCookie.remove('COMMONS_SESSION');
              ipCookie.remove('COMMONS_SESSION', { path: '/' });

              //
              // Start a new Alerts array that is empty, this clears out any previous
              // messages that may have been presented on another page
              //
              $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

              $rootScope.alerts.push({
                'type': 'info',
                'title': 'Please sign in again',
                'details': 'You may only sign in at one location at a time'
              });

              $location.hash('');
              $location.path('/');
            }

          }

        });

        return promise;
      };

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

      Application.GetApplication = function(applicationId) {

        //
        // Get the single application that the user wants to view
        //
        var promise = Application.get({
            id: applicationId
          }).$promise.then(function(response) {
            return response.response;
          }, function(error) {
            $rootScope.alerts.push({
              'type': 'error',
              'title': 'Uh-oh!',
              'details': 'Mind reloading the page? It looks like we couldn\'t get that Application for you.'
            });
          });

        return promise;
      };

      return Application;
    }];
  });

'use strict';

angular.module('commonsCloudAdminApp')
  .provider('Import', function () {

    this.$get = ['$resource', function ($resource) {

      var Import = $resource('//api.commonscloud.org/v2/:storage/import.json', {

      }, {
        postFiles: {
          method: 'POST',
          transformRequest: angular.identity,
          headers: {
            'Content-Type': undefined
          }
        }
      });

      return Import;
    }];

  });

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('IndexCtrl', ['$rootScope', '$scope', 'ipCookie', '$location', '$window', 'User', function($rootScope, $scope, ipCookie, $location, $window, User) {

    var session_cookie = ipCookie('COMMONS_SESSION');

    $scope.setupLoginPage = function() {
      var host = $location.host();

      //
      // Redirect based on current enviornment
      //
      if (host === 'localhost' || host === '127.0.0.1') {
        $scope.login_url = 'http://api.commonscloud.org/oauth/authorize?response_type=token&client_id=PGvNp0niToyRspXaaqx3PiQBMn66QXyAq5yrNHpz&redirect_uri=http%3A%2F%2F127.0.0.1%3A9000%2Fauthorize&scope=user applications';
      } else {
        $scope.login_url = 'http://api.commonscloud.org/oauth/authorize?response_type=token&client_id=MbanCzYpm0fUW8md1cdSJjUoYI78zTbak2XhZ2hF&redirect_uri=http%3A%2F%2Fapp.commonscloud.org%2Fauthorize&scope=user applications';
      }

    };

    if (session_cookie && session_cookie !== undefined && session_cookie !== 'undefined') {
      console.log('session_cookie from index > if!', session_cookie);
      if (!$rootScope.user) {
        $rootScope.user = User.getUser();
      }
      $location.hash('');
      $location.path('/applications');
    } else {
      ipCookie.remove('COMMONS_SESSION');
      ipCookie.remove('COMMONS_SESSION', { path: '/' });
      console.log('session_cookie from index > else', session_cookie);
      $scope.setupLoginPage();
    }

  }]);

'use strict';

angular.module('commonsCloudAdminApp').controller('AuthorizeCtrl', ['$scope', '$rootScope', '$location', 'ipCookie', function($scope, $rootScope, $location, ipCookie) {

    var session_cookie = ipCookie('COMMONS_SESSION');

    $scope.saveAuthorization = function() {
      var locationHash = $location.hash();
      var accessToken = locationHash.substring(0, locationHash.indexOf('&'));
      var cleanToken = accessToken.replace('access_token=', '');

      var cookieOptions = {
        path: '/',
        expires: 2
      };

      ipCookie('COMMONS_SESSION', cleanToken, cookieOptions);

      $location.hash('');
      $location.path('/applications');
    };


    $scope.verifyAuthorization = function() {
      if (session_cookie && session_cookie !== undefined && session_cookie !== 'undefined') {
        $location.hash('');
        $location.path('/applications');
      } else {
        //
        // Clear out existing COMMONS_SESSION cookies that may be invalid or
        // expired. This may happen when a user closes the window and comes back
        //
        ipCookie.remove('COMMONS_SESSION');
        ipCookie.remove('COMMONS_SESSION', { path: '/' });
        
        $scope.saveAuthorization();
      }
    };

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('LogoutCtrl', ['$scope', 'ipCookie', '$location', function($scope, ipCookie, $location) {

    console.log('LogoutCtrl');

    $scope.logout = function() {
      ipCookie.remove('COMMONS_SESSION');
      ipCookie.remove('COMMONS_SESSION', { path: '/' });

      $location.hash();
      $location.path('/');
    };

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('ApplicationsCtrl', ['$rootScope', '$scope', '$timeout', 'applications', 'user', function ($rootScope, $scope, $timeout, applications, user) {

    //
    // Get a list of all Applications the user has access to
    //
    $scope.applications = applications;

    $scope.page = {
      title: "My Applications"
    };


    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 15000);

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('ApplicationCtrl', ['$rootScope', '$scope', '$routeParams', '$timeout', 'application', 'templates', 'Feature', 'user', function ($rootScope, $scope, $routeParams, $timeout, application, templates, Feature, user) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our existing content
    //
    $scope.application = application;
    $scope.templates = templates;
    $scope.features = {};

    $scope.loading = true;

    //
    // Template sorting options
    //
    $scope.orderByField = 'id'; // -- field to order by
    $scope.reverseSort = false; // -- sort order, true === desc, false === asc

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    // Any existing alerts will be cleared out after 25 seconds
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 25000);


  //
  // CONTENT
  //

    //
    // Return a total count of features per template, or a total number of features needing moderated
    // per feature template
    //
    $scope.features.count = function (count_type) {

      angular.forEach($scope.templates, function(template, index) {

        var q = {},
            template = $scope.templates[index];

        //
        // If the Count Type is Moderation then we need to make sure that we append special
        // query parameters to the request to filter the totals down to only be the features
        // that are in the 'crowd' feature status, meanign they need moderation
        //
        if (count_type === 'moderation') {
          var q = {
            'filters': [
              {
                'name': 'status',
                'op': 'eq',
                'val': 'crowd'
              }
            ]
          };        
        }

        //
        // Execute a query to a specified feature collection and return a total number of
        // features associated with that Feature Collection
        //
        Feature.query({
          storage: template.storage,
          q: q,
          updated: new Date().getTime()
        }).$promise.then(function(response) {
          if (count_type === 'features') {
            $scope.templates[index].features = response;
          } else {
            $scope.templates[index].moderation = (response.properties.total_features > 0) ? true: false;            
          }
        });

      });
    };

    //
    // Retrieve the total number of features for each template
    //
    $scope.features.count('features');

    //
    // Determine if any features are in need of being moderated
    //
    $scope.features.count('moderation');

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('ApplicationCreateCtrl', ['$rootScope', '$scope', '$location', '$timeout', 'Application', 'user', function ($rootScope, $scope, $location, $timeout, Application, user) {

    //
    // Instantiate an Application object so that we can perform all necessary
    // functionality against our Application resource
    //
    $scope.application = new Application();

    $scope.page = {
      title: 'New Application',
      back: '/applications/'
    };

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);


    //
    // Save a new Application to the API Database
    //
    $scope.save = function () {

      //
      // Save the Application via a post to the API and then push it onto the
      // Applications array, so that it appears in the user interface
      //
      $scope.application.$save().then(function (response) {

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
  .controller('ApplicationEditCtrl', ['$route', '$rootScope', '$scope', '$routeParams', '$location', '$timeout', 'Application', 'application', 'user', function ($route, $rootScope, $scope, $routeParams, $location, $timeout, Application, application, user) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our existing content
    //
    $scope.application = application;

    $scope.page = {
      title: 'Edit Application',
      back: '/applications/' + $scope.application.id
    }

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);


  //
  // CONTENT
  //

    //
    // Save a new Application to the API Database
    //
    $scope.UpdateApplication = function () {

      if ($scope.application.id) {
        $scope.EditApplication = false;
        Application.update({
          id: $scope.application.id,
          updated: new Date().getTime()
        }, $scope.application).$promise.then(function(response) {
          $rootScope.alerts = [];
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
        id: application_.id,
        updated: new Date().getTime()
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

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('TemplateCtrl', ['$rootScope', function ($rootScope) {

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('TemplateCreateCtrl', ['$rootScope', '$routeParams', '$scope', '$timeout', '$location', 'application', 'user', 'Template', function ($rootScope, $routeParams, $scope, $timeout, $location, application, user, Template) {

    //
    // Instantiate an Application object so that we can perform all necessary
    // functionality against our Application resource
    //
    $scope.application = application;
    $scope.newTemplate = new Template();

    $scope.page = {
      title: 'Add a Feature Collection',
      back: '/applications/' + $scope.application.id
    }

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

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
  .controller('TemplateEditCtrl', ['$rootScope', '$routeParams', '$scope', '$timeout', 'Application', 'Template', 'User', '$location', function ($rootScope, $routeParams, $scope, $timeout, Application, Template, User, $location) {

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

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
          templateId: template_id,
          updated: new Date().getTime()
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
        templateId: $scope.template.id,
        updated: new Date().getTime()
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

//
    // Delete an existing Template from the API Database
    //
    $scope.DeleteTemplate = function (template) {

      //
      // Construct an object containing only the Application ID so that we
      // aren't sending along Application parameters in the URL
      //
      var template_ = {
        id: template.id
      };

      //
      // Send the 'DELETE' method to the API so it's removed from the database
      //
      Template.delete({
        templateId: template_.id,
        updated: new Date().getTime()
      }, template_).$promise.then(function(response) {
        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Updated',
          'details': 'Your template was deleted!'
        });

        $location.path('/applications/' + $scope.application.id + '/collections');
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? It looks like we couldn\'t delete that Template for you.'
        });
      });
    };

    $scope.GetApplication();

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('TemplateDevCtrl', ['$rootScope', '$routeParams', '$scope', '$timeout', 'Application', 'Template', 'User', '$location', function ($rootScope, $routeParams, $scope, $timeout, Application, Template, User, $location) {

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

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
          templateId: template_id,
          updated: new Date().getTime()
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
  .controller('TemplateImportCtrl', ['$rootScope', '$routeParams', '$scope', '$timeout', '$location', 'Application', 'Template', 'User', 'Import', function ($rootScope, $routeParams, $scope, $timeout, $location, Application, Template, User, Import) {

    //
    // Instantiate an Application object so that we can perform all necessary
    // functionality against our Application resource
    //
    $scope.application = {};
    $scope.template = {};
    $scope.activities = [];

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
          templateId: template_id,
          updated: new Date().getTime()
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

          $scope.getActivities(template_id);

        });
    };

    $scope.getActivities = function(template_id) {

      Template.activity({
          templateId: template_id,
          updated: new Date().getTime()
        }).$promise.then(function(response) {
          console.log('Template.activity response', response);
          $scope.activities = response.response.activities;
        });
    };


    $scope.onFileSelect = function(files) {

      angular.forEach(files, function(file, index) {

        //
        // Add import to Activities list
        //
        var new_index = $scope.activities.push({
          'name': 'Import content from CSV',
          'description': '',
          'file': file,
          'created': '',
          'updated': '',
          'status': 'Uploading'
        });
        $scope.$apply();
        console.log('activities', $scope.activities);

        //
        // Create a file data object for uploading
        //
        var fileData = new FormData();
        fileData.append('import', file);

        //
        // Post CSV to server to begin import process
        //
        $scope.uploadFeatureImport(fileData, new_index-1);

      });

    };

    $scope.uploadFeatureImport = function(fileData, file_index) {

      Import.postFiles({
        storage: $scope.template.storage
      }, fileData).$promise.then(function(response) {

        $scope.activities[file_index].status = 'Queued'

        $rootScope.alerts.push({
          'type': 'success',
          'title': 'Yes!',
          'details': 'Your CSV has been successfully queued for import'
        });

      }, function(error) {
        console.log('Import failed!!!!', error);
      });

    };

    $scope.GetApplication();

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('CollaboratorsCtrl', ['$rootScope', '$scope', '$timeout', 'application', 'user', function ($rootScope, $scope, $timeout, application, user) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our existing content
    //
    $scope.application = application;

    $scope.page = {
      title: 'Collaborators',
      back: '/applications/' + $scope.application.id
    }

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);


  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FeaturesCtrl', ['$rootScope', '$scope', '$routeParams', '$timeout', 'application', 'template', 'features', 'fields', 'user', function ($rootScope, $scope, $routeParams, $timeout, application, template, features, fields, user) {

  //
  // VARIABLES
  //

    //
    // Placeholders for our on-screen content
    //
    $scope.application = application;
    $scope.template = template;
    $scope.features = features.response.features;
    $scope.featureproperties = features.response.properties;
    $scope.fields = fields;

    $scope.page = {
      title: $scope.template.name + ' features',
      back: '/applications/' + $scope.application.id
    }

    //
    // Ensure the Templates are sorted oldest to newest
    //
    $scope.orderByField = 'id';
    $scope.reverseSort = true;

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);


  //
  // CONTENT
  //

    //
    // Update how Features are sorted based on Field/Header clicked and
    // react to a second click by inverting the order
    //
    $scope.ChangeOrder = function (value) {
      $scope.orderByField = value;
      $scope.reverseSort =! $scope.reverseSort;
    };

  }]);

'use strict';

angular.module('commonsCloudAdminApp')
  .controller('FeatureCreateCtrl', ['$rootScope', '$scope', '$routeParams', '$window', '$timeout', '$location', '$http', 'Application', 'Template', 'Feature', 'Field', 'User', 'geolocation', 'leafletData', function ($rootScope, $scope, $routeParams, $window, $timeout, $location, $http, Application, Template, Feature, Field, User, geolocation, leafletData) {

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
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

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
      tileLayerOptions: {
        detectRetina: true,
        reuseTiles: true,
      },
      scrollWheelZoom: false,
      zoomControl: false
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
          templateId: $scope.template.id,
          updated: new Date().getTime()
        }).$promise.then(function(response) {
          
          $scope.fields = $scope.PrepareFields(response);

          // $scope.getEnumeratedValues($scope.fields);

          $scope.getEditableMap();
        });
    };

    $scope.PrepareFields = function(fields) {

      var processed_fields = [];

      angular.forEach(fields, function(field, index) {

        if (field.data_type === 'list') {
          field.options = field.options.split(',');
        }

        processed_fields.push(field);
      });

      return processed_fields;
    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: $routeParams.templateId,
          updated: new Date().getTime()
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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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

        new L.Control.Zoom({
          position: 'bottomright'
        }).addTo(map);

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
    // $scope.getEnumeratedValues = function (field_list) {
    //
    //   angular.forEach(field_list, function (field_, index) {
    //     if (field_.data_type === 'relationship') {
    //       Feature.query({
    //           storage: field_.relationship
    //         }).$promise.then(function (response) {
    //           $scope.fields[index].values = response.response.features;
    //         }, function(error) {
    //           $rootScope.alerts.push({
    //             'type': 'error',
    //             'title': 'Uh-oh!',
    //             'details': 'Something stranged happened, please reload the page.'
    //           });
    //         });
    //     }
    //   });
    //
    // };

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

      // angular.forEach($scope.fields, function(field, index) {
      //   if (field.data_type === 'relationship') {
      //     if (angular.isArray($scope.feature[field.relationship]) && $scope.feature[field.relationship].length >= 1) {
      //
      //       var relationship_array_ = [];
      //
      //       angular.forEach($scope.feature[field.relationship], function (value, index) {
      //         relationship_array_.push({
      //           'id': value
      //         });
      //       });
      //
      //       $scope.feature[field.relationship] = relationship_array_;
      //     } else if (angular.isNumber($scope.feature[field.relationship])) {
      //
      //       var value = $scope.feature[field.relationship];
      //
      //       $scope.feature[field.relationship] = [{
      //         'id': value
      //       }];
      //
      //     }
      //   }
      // });

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
          $scope.feature = response.response

          $rootScope.alerts.push({
            'type': 'success',
            'title': 'Yes!',
            'details': 'Your new Features created.'
          });

          $location.path('/applications/' + $scope.application.id + '/collections/' + $scope.template.id + '/features/' + $scope.feature.id);
        }, function(error) {
          console.log('Update failed!!!!', error);
        });

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

    $scope.initGeocoder = function() {
      var requested_location = $scope.geocoder;

      console.log(requested_location);

      var geocode_service_url = '//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + requested_location + '.json';
      $http({
        method: 'get',
        url: geocode_service_url,
        params: {
          'callback': 'JSON_CALLBACK',
          'access_token': 'pk.eyJ1IjoiZGV2ZWxvcGVkc2ltcGxlIiwiYSI6Il9aYmF0eWMifQ.IKV2X58Q7rhaqVBEKPbJMw'
        },
        headers: {
          'Authorization': 'external'
        }
      }).success(function(data) {

        console.log('data', data);
        $scope.geocode_features = data.features;

        // if (data === 'JSON_CALLBACK({});') {
        //   console.log('No geocode found');
        // }

        // var coordinates = data.results[0].centroid.coordinates;
        // var lat = data.results[0][0].lat;
        // var lon = data.results[0][0].lon;
        // var centroid = {
        //   'type': 'POINT',
        //   'coordinates': [
        //     lon,
        //     lat
        // ]};
        // var coordinates = centroid.coordinates;
        // console.log('coordinates', coordinates);
        // if (coordinates) {
        //   PersistData.AddCoordinates(coordinates);
        //   createMap(PersistData.property.coordinates);
        // } else {
        //   console.log('cant find the property', data);
        // }
      }).error(function(data, status, headers, config) {
        console.log('ERROR: ', data);
      });

    };

    $scope.centerMapOnGeocode = function(result) {

      //
      // Once we click on an address we need to clear out the search field and
      // the list of possible results so that we can see the map and allow the
      // click event to center the map.
      //
      $scope.geocoder = '';
      $scope.geocode_features = [];

      leafletData.getMap().then(function(map) {

        map.setView([result.center[1], result.center[0]], 18);

        map.fitBounds(map.getBounds());

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
  .controller('FeatureEditCtrl', ['$rootScope', '$scope', '$route', '$routeParams', '$window', '$timeout', '$location', '$http', '$anchorScroll', 'Application', 'Template', 'Feature', 'Field', 'User', 'Attachment', 'geolocation', 'leafletData', function ($rootScope, $scope, $route, $routeParams, $window, $timeout, $location, $http, $anchorScroll, Application, Template, Feature, Field, User, Attachment, geolocation, leafletData) {

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

    //
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    // $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 30000);

    $rootScope.user = User.getUser();

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
      tileLayerOptions: {
        detectRetina: true,
        reuseTiles: true,
      },
      scrollWheelZoom: false,
      zoomControl: false
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
          featureId: feature_id,
          updated: new Date().getTime()
        }).$promise.then(function(response) {
          $scope.feature = response.response;
          // $scope.getEnumeratedValues($scope.fields);
          $scope.getEditableMap(response.response.geometry);
        }, function(error) {
          $rootScope.alerts = [];
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
          $scope.fields = $scope.PrepareFields(response);

          if ($routeParams.featureId) {
            $scope.GetFeature($routeParams.featureId);
          }
        });
    };

    $scope.PrepareFields = function(fields) {

      var processed_fields = [];

      angular.forEach(fields, function(field, index) {

        if (field.data_type === 'list') {
          field.options = field.options.split(',');
        }

        processed_fields.push(field);
      });

      return processed_fields;
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


    $scope.getEditableMap = function (default_geometry) {

      leafletData.getMap().then(function(map) {

        if (default_geometry) {
          console.debug('$scope.feature.geometry', $scope.feature.geometry);
          $scope.feature.geometry = $scope.convertGeometryCollectionToFeatureCollection(default_geometry);
          $scope.geojsonToLayer($scope.feature.geometry, featureGroup);

          console.debug('Setting default geometry with $scope.feature.geometry', $scope.feature.geometry);

          map.fitBounds(featureGroup.getBounds());
        } else {
          console.log('No default_geometry provided', default_geometry);
        }

        $scope.$watch('default_geometry', function() {
          if ((!angular.isUndefined($scope.default_geometry)) && ($scope.default_geometry !== null) && ($scope.default_geometry.hasOwnProperty('coordinates'))) {
            console.debug('Updating to user\'s current location with $scope.default_geometry', default_geometry);
            map.setView([$scope.default_geometry.coordinates[1], $scope.default_geometry.coordinates[0]], 13);
          }
        });

        // $scope.$watch('feature', function() {
        //   if (($scope.feature !== null) && ($scope.feature.hasOwnProperty('geometry'))) {
        //     $scope.feature.geometry = $scope.convertGeometryCollectionToFeatureCollection($scope.feature.geometry);
        //     $scope.geojsonToLayer($scope.feature.geometry, featureGroup);
        //     map.fitBounds(featureGroup.getBounds());
        //   } else {
        //     console.log('No $scope.feature.geometry found', $scope.feature.geometry);
        //   }
        // });

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

        new L.Control.Zoom({
          position: 'bottomright'
        }).addTo(map);

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
    // $scope.getEnumeratedValues = function (field_list) {
    //
    //   angular.forEach(field_list, function (field_, index) {
    //     if (field_.data_type === 'relationship') {
    //       Feature.query({
    //           storage: field_.relationship
    //         }).$promise.then(function (response) {
    //           $scope.fields[index].values = response.response.features;
    //
    //           var default_values = [];
    //
    //           angular.forEach($scope.feature[field_.relationship], function (feature, index) {
    //             default_values.push(feature.id);
    //           });
    //
    //           $scope.feature[field_.relationship] = default_values;
    //
    //         }, function(error) {
    //           $rootScope.alerts.push({
    //             'type': 'error',
    //             'title': 'Uh-oh!',
    //             'details': 'Something stranged happened, please reload the page.'
    //           });
    //         });
    //     }
    //   });
    //
    // };

    //
    // Convert a FeatureCollection to a GeometryCollection so that it can be
    // saved to a Geometry field within the CommonsCloud API
    //
    $scope.convertFeatureCollectionToGeometryCollection = function (featureCollection) {

      if (featureCollection.type === 'GeometryCollection') {
        return featureCollection;
      }

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

      if (geometryCollection.type === 'FeatureCollection') {
        return geometryCollection;
      }

      var ExistingCollection = angular.fromJson(geometryCollection);

      var NewFeatureCollection = {
        'type': 'FeatureCollection',
        'features': []
      };

      if (ExistingCollection !== null && ExistingCollection !== undefined && ExistingCollection.hasOwnProperty('geometries')) {
        console.log('We got a geometry collection');
        angular.forEach(ExistingCollection.geometries, function (feature, index) {
          var geometry_ = {
            'type': 'Feature',
            'geometry': feature
          };

          NewFeatureCollection.features.push(geometry_);
        });
      } else if (ExistingCollection !== null && ExistingCollection !== undefined && ExistingCollection.hasOwnProperty('coordinates')) {
        console.log('Better just add this to the Feature collection and call it a day');
        NewFeatureCollection.features.push(ExistingCollection);
      }


      return NewFeatureCollection;

    };


    //
    // Update the attributes of an existing Template
    //
    $scope.UpdateFeature = function () {

      if ($scope.feature.geometry) {
        console.log('Full Feature before conversion', $scope.feature);
        console.log('Existing geometry collection', $scope.feature.geometry);
        $scope.feature.geometry = $scope.convertFeatureCollectionToGeometryCollection($scope.feature.geometry);
        console.log('Updated geometry collection', $scope.feature.geometry);
      }

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
          $scope.feature = response.response;

          $rootScope.alerts = [];
          $rootScope.alerts.push({
            'type': 'success',
            'title': 'Awesome!',
            'details': 'Your Feature updates were saved successfully!'
          });
          $location.hash('top');
          $anchorScroll();
          $location.hash('');
        }, function(error) {
          console.log('Update failed!!!!', error);
        });

        // $route.reload();
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
              // 'caption': $scope.feature[field_name][index].caption,
              // 'credit': $scope.feature[field_name][index].credit,
              // 'credit_link': $scope.feature[field_name][index].credit_link
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
            // 'caption': $scope.feature[field_name][index].caption,
            // 'credit': $scope.feature[field_name][index].credit,
            // 'credit_link': $scope.feature[field_name][index].credit_link
          };
          $scope.files.push(new_file);
          $scope.feature[field_name].push(new_file);
          $scope.$apply();
          console.log('files', $scope.files);
          console.log('$scope.feature[' + field_name + ']', $scope.feature[field_name]);
        }
      });

    };

    $scope.initGeocoder = function() {
      var requested_location = $scope.geocoder;

      console.log(requested_location);

      var geocode_service_url = '//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + requested_location + '.json';
      $http({
        method: 'get',
        url: geocode_service_url,
        params: {
          'callback': 'JSON_CALLBACK',
          'access_token': 'pk.eyJ1IjoiZGV2ZWxvcGVkc2ltcGxlIiwiYSI6Il9aYmF0eWMifQ.IKV2X58Q7rhaqVBEKPbJMw'
        },
        headers: {
          'Authorization': 'external'
        }
      }).success(function(data) {

        console.log('data', data);
        $scope.geocode_features = data.features;

        // if (data === 'JSON_CALLBACK({});') {
        //   console.log('No geocode found');
        // }

        // var coordinates = data.results[0].centroid.coordinates;
        // var lat = data.results[0][0].lat;
        // var lon = data.results[0][0].lon;
        // var centroid = {
        //   'type': 'POINT',
        //   'coordinates': [
        //     lon,
        //     lat
        // ]};
        // var coordinates = centroid.coordinates;
        // console.log('coordinates', coordinates);
        // if (coordinates) {
        //   PersistData.AddCoordinates(coordinates);
        //   createMap(PersistData.property.coordinates);
        // } else {
        //   console.log('cant find the property', data);
        // }
      }).error(function(data, status, headers, config) {
        console.log('ERROR: ', data);
      });

    };

    $scope.centerMapOnGeocode = function(result) {

      //
      // Once we click on an address we need to clear out the search field and
      // the list of possible results so that we can see the map and allow the
      // click event to center the map.
      //
      $scope.geocoder = '';
      $scope.geocode_features = [];

      leafletData.getMap().then(function(map) {

        map.setView([result.center[1], result.center[0]], 18);

        map.fitBounds(map.getBounds());

      });
    };

    $scope.DeleteAttachment = function(file, $index, attachment_storage) {

      $scope.feature[attachment_storage].splice($index, 1);

      // console.log($scope.template.storage, $scope.feature.id, attachment_storage, file.id)

      //
      // Send the 'DELETE' method to the API so it's removed from the database
      //
      Attachment.delete({
        storage: $scope.template.storage,
        featureId: $scope.feature.id,
        attachmentStorage: attachment_storage,
        attachmentId: file.id
      }).$promise.then(function(response) {
        console.log('DeleteAttachment', response);
        $route.reload();
      }, function(error) {
        $rootScope.alerts.push({
          'type': 'error',
          'title': 'Uh-oh!',
          'details': 'Mind trying that again? We couldn\'t remove that Attachment.'
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
  .controller('StatisticsCtrl', ['$route', '$rootScope', '$scope', '$routeParams', '$location', '$timeout', 'Application', 'Template', 'Statistic', 'User', function ($route, $rootScope, $scope, $routeParams, $location, $timeout, Application, Template, Statistic, User) {


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
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
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
          templateId: template_id,
          updated: new Date().getTime()
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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
  .controller('StatisticCreateCtrl', ['$rootScope', '$scope', '$routeParams', '$timeout', '$location', 'Application', 'Template', 'Field', 'Statistic', 'User', function ($rootScope, $scope, $routeParams, $timeout, $location, Application, Template, Field, Statistic, User) {

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
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
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
          templateId: template_id,
          updated: new Date().getTime()
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
          templateId: $scope.template.id,
          updated: new Date().getTime()
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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
  .controller('StatisticEditCtrl', ['$rootScope', '$scope', '$routeParams', '$location', '$timeout', 'Application', 'Template', 'Field', 'Statistic', 'User', function ($rootScope, $scope, $routeParams, $location, $timeout, Application, Template, Field, Statistic, User) {


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
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

    //
    // Controls for showing/hiding specific page elements that may not be
    // fully loaded or when a specific user interaction has not yet happened
    //
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
          templateId: template_id,
          updated: new Date().getTime()
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
          templateId: $scope.template.id,
          updated: new Date().getTime()
        }).$promise.then(function(response) {
          $scope.fields = response;
        });
    };

    $scope.GetStatistic = function(template_id, statistic_id) {
      Statistic.get({
        templateId: template_id,
        statisticId: statistic_id,
        updated: new Date().getTime()
      }).$promise.then(function (response) {
        $scope.statistic = response;
      });
    };

    $scope.UpdateStatistic = function (statistic) {
      Statistic.update({
          templateId: $scope.template.id,
          statisticId: statistic.id,
          updated: new Date().getTime()
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
        statisticId: statistic.id,
        updated: new Date().getTime()
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
        id: $routeParams.applicationId,
        updated: new Date().getTime()
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
  .controller('FieldsCtrl', ['$rootScope', '$scope', '$routeParams', '$timeout', 'Application', 'Template', 'Field', 'User', '$location', '$anchorScroll', function ($rootScope, $scope, $routeParams, $timeout, Application, Template, Field, User, $location, $anchorScroll) {

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
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

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
          templateId: $scope.template.id,
          updated: new Date().getTime()
        }).$promise.then(function(response) {
          $scope.fields = response;
        });
    };

    $scope.GetTemplate = function(template_id) {
      Template.get({
          templateId: $routeParams.templateId,
          updated: new Date().getTime()
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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
  .controller('FieldCreateCtrl', ['$rootScope', '$scope', '$routeParams', '$timeout', 'Application', 'Template', 'Field', 'User', '$location', function ($rootScope, $scope, $routeParams, $timeout, Application, Template, Field, User, $location) {

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
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

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
          applicationId: application_id,
          updated: new Date().getTime()
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
          templateId: template_id,
          updated: new Date().getTime()
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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
  .controller('FieldEditCtrl', ['$rootScope', '$scope', '$routeParams', '$timeout', 'Application', 'Template', 'Field', 'User', '$location', function ($rootScope, $scope, $routeParams, $timeout, Application, Template, Field, User, $location) {

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
    // Start a new Alerts array that is empty, this clears out any previous
    // messages that may have been presented on another page
    //
    $rootScope.alerts = ($rootScope.alerts) ? $rootScope.alerts: [];

    $timeout(function () {
      $rootScope.alerts = [];
    }, 5000);

    $rootScope.user = User.getUser();

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
          fieldId: field_id,
          updated: new Date().getTime()
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
        fieldId: $scope.field.id,
          updated: new Date().getTime()
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
        fieldId: field.id,
        updated: new Date().getTime()
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
          templateId: $routeParams.templateId,
          updated: new Date().getTime()
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
          id: $routeParams.applicationId,
          updated: new Date().getTime()
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
  .directive('relationship', function ($http, $timeout) {
	function link(scope, el, attrs) {
		//create variables for needed DOM elements
		var container = el.children()[0];
		var input = angular.element(container.children[0]);
		var dropdown = angular.element(container.children[1]);
		var timeout;
    scope.relationship_focus = false;

    //
    // scope.human_readable_values = (scope.model) ? scope.model: [];
    //
    // scope.$watch('model', function (data) {
    //   console.log('model updated', data);
    //   scope.human_readable_values = data;
    // });

    console.log('enumerated value checking', scope.human_readable_values, scope.model);

    scope.getPlaceholderText = function(field) {

      var label = field.label;
      var article = 'a';

      // if ("aeiouAEIOU".indexOf(label) != -1) {
      if (/[aeiouAEIOU]/.test(label)) {
        article = 'an';
      }

      return 'Choose ' + article + ' ' + label;
    };

    scope.placeholder = scope.getPlaceholderText(scope.field);

		//$http request to be fired on search
		var getFilteredResults = function(field){
			var table = field.relationship;
			var url = '//api.commonscloud.org/v2/' + table + '.json';

			$http({
				method: 'GET',
				url: url,
				params: {
					'q': {
						'filters':
						[
							{
								'name': 'name',
								'op': 'ilike',
								'val': '%' + scope.searchText + '%'
							}
						]
					},
          'results_per_page': 6
				}
			}).success(function(data){
				//assign feature objects to scope for use in template
				scope.features = data.response.features;
			});
		};

    var set = function(arr) {
      return arr.reduce(function (a, val) {
        if (a.indexOf(val) === -1) {
            a.push(val);
        }
        return a;
      }, []);
    }

		//search with timeout to prevent it from firing on every keystroke
		scope.search = function(){
			$timeout.cancel(timeout);

			timeout = $timeout(function () {
				getFilteredResults(scope.field);
			}, 2000);
		};

		scope.addFeatureToRelationships = function(feature){

      if (angular.isArray(scope.model)) {
        // scope.human_readable_values.push(feature);
        scope.model.push(feature);
      } else {
        scope.model = [];
        // scope.human_readable_values.push(feature);
        scope.model.push(feature);
      }

      scope.model = set(scope.model);

      // Clear out input field
      scope.searchText = '';
      scope.features = [];
		};

    scope.removeFeatureFromRelationships = function(index) {
      // delete scope.human_readable_values.splice(index, 1);
      delete scope.model.splice(index, 1);
    };

    scope.resetField = function() {
      scope.searchText = '';
      scope.features = [];
      scope.relationship_focus = false;
      console.log('Field reset');
    };

	}

	return {
	  scope: {
			field: '=',
      feature: '=',
      model: '='
	  },
	  templateUrl: '/views/includes/relationship.html',
	  restrict: 'E',
	  link: link
	};
});