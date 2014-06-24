require (["dojo/_base/array","dojo/dom-geometry","dojo/aspect",
               "dgrid/OnDemandGrid","dgrid/Grid","dgrid/Selection","dgrid/selector","dgrid/tree",
               "dgrid/extensions/ColumnResizer","dgrid/extensions/ColumnHider","dgrid/extensions/ColumnReorder","dgrid/extensions/DijitRegistry","dgrid/extensions/DnD",
               "dojox/form/CheckedMultiSelect","dojox/form/FileInput","dojox/form/Uploader","dojox/form/uploader/FileList","dojox/validate/web","dojox/validate/check","dojox/widget/Calendar",
               "dojox/gfx","dojox/gfx/fx","dojox/gfx/utils","dojox/gfx/Moveable","dojox/gesture/tap","dojox/gesture/swipe",
               "dojox/html/styles","dojo/dom-construct",
               "dojox/charting/widget/Chart","dojox/charting/widget/Legend","dojox/charting/axis2d/Default","dojox/charting/plot2d/Lines","dojox/charting/plot2d/Pie","dojox/charting/plot2d/ClusteredColumns",
               "dijit/Menu","dijit/Dialog","dijit/Tree","dijit/Toolbar","dijit/ProgressBar","dijit/Tooltip",
               "dijit/form/TextBox","dijit/form/DateTextBox","dijit/form/Form","dijit/form/FilteringSelect","dijit/form/Textarea","dijit/form/NumberTextBox","dijit/form/ComboBox","dijit/form/TimeTextBox","dijit/form/Select","dijit/form/NumberSpinner","dijit/form/HorizontalSlider",
               "dijit/layout/ContentPane","dijit/layout/TabContainer","dijit/layout/BorderContainer","dijit/layout/AccordionContainer",
               "dojo/io/iframe"
              ],
              function(
              __array,__geometry,__aspect,
              __ODGrid,__Grid,__Selection,__selector,__tree,
              __ColumnResizer,__ColumnHider,__ColumnReorder,__DijitRegistry,__DnD
              ) {
  dojo.array = __array; dojo.domGeo = __geometry; dojo.aspect = __aspect;
  dgrid = {};
  dgrid.OnDemandGrid = __ODGrid; dgrid.Grid = __Grid; dgrid.Selection = __Selection; dgrid.selector = __selector; dgrid.tree = __tree;
  dgrid.ColumnResizer = __ColumnResizer; dgrid.ColumnHider = __ColumnHider; dgrid.ColumnReorder = __ColumnReorder; dgrid.DijitRegistry = __DijitRegistry; dgrid.DnD = __DnD;
  
//wsConnectionHandler
dojo.declare("FIRMOS.wsConnectionHandler", null, {
  constructor: function() {
    this.ws = null;
    this.reqId = 0;
    this.binDataKey = 0;
    this.openReq = new Object();
    this.updateId = null;
    this.docLoaded = false;
    this._createWS();
    this._logLoadingError = true;
  },
  
  documentLoaded: function() {
    console.log("DOCUMENT ONLOAD");
    var menu=new FIRMOS.Menu({contextMenuForWindow:true});
    this.docLoaded = true;
  },
  
  _createWS: function() {
    var sessionId = this.getSessionId();
    if (sessionId) {
      var protocol_postfix = sessionId;
    } else {
      var protocol_postfix = 'NEW';
    }
    if ("https:" == document.location.protocol) {
      var protocol_prefix = 'wss://';
    } else {
      var protocol_prefix = 'ws://';
    }
    this.ws = new WebSocket(protocol_prefix+window.location.hostname+':'+window.location.port+'/FirmOS_FRE_WS','FirmOS-FREDB-'+protocol_postfix);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onmessage = this.wsMessageListener.bind(this);
    this.ws.onclose = this.wsCloseListener.bind(this);
    this.ws.onerror = this.wsErrorListener.bind(this);
    this.ws.onopen = this.wsOpenListener.bind(this);
  },
  
  callServerFunction: function(classname, functionname, uidPath, params, callback, contentId, blob, binDataKey) {
    var ret = G_UI_COM.beforeCallServerFunction(classname, functionname, uidPath, params);
    if (ret.abort) return;
    if (ret.uidPath) uidPath = ret.uidPath;
    if (ret.params) params = ret.params;

    if (!this.docLoaded) {
      if (this._logLoadingError) {
        console.log('DOCUMENT LOADING => WAIT');
        this._logLoadingError = false;
      }
      setTimeout(this.callServerFunction.bind(this, classname, functionname, uidPath, params, callback, contentId, blob), 10);
      return;
    }
    if (this.ws.readyState!=1) { // NOT OPEN => try again
      switch (this.ws.readyState) {
        case 0: //CONNECTING
          console.log('WS CONNECTING => WAIT');
          setTimeout(this.callServerFunction.bind(this, classname, functionname, uidPath, params, callback, contentId, blob), 10);
          break;
        case 2: //CLOSING
          console.log('WS CLOSING => WAIT');
          setTimeout(this.callServerFunction.bind(this, classname, functionname, uidPath, params, callback, contentId, blob), 100);
          break;
        case 3: //CLOSED
          console.log('WS CLOSED => RECREATE');
          this._createWS();
          break;
      }
      return;
    }
    console.log('WS OK => CALL');
    console.log(classname + ' - ' + functionname + ' - ' + uidPath + ' - ' + JSON.stringify(params) + ' - BLOB: ' + (typeof blob != 'undefined') + ' - STATE: ' + this.ws.readyState);
    var messageObj = {
      cn: classname,
      fn: functionname,
      uidPath: uidPath,
      rId: this.reqId,
      rType: 'S'
    }
    if (typeof binDataKey!='undefined' && binDataKey!=null) {
      messageObj.bDK = binDataKey;
    }
    if (typeof contentId!='undefined' && contentId!=null) {
      messageObj.cId = contentId;
    }
    if (typeof params!='undefined' && params!=null) {
      messageObj.params = params;
    }
    var message = dojo.toJson(messageObj);
    if (!callback) {
      callback = this.handleServerFunctionResponse.bind(this);
    }

    this.openReq[this.reqId] = {
                                fn: callback,
                                uiState: G_UI_COM.getUIState(),
                                messageObj: messageObj
                               };
    if (typeof blob!='undefined' && blob!=null) {
      var json = this.encodeString2Message(message);
      var barr = new Uint8Array(4);
      var json_length = json.length;
      barr[3]=(json_length >> 24);
      barr[2]=(json_length >> 16) & 0xFF;
      barr[1]=(json_length >> 8) & 0xFF;
      barr[0]=json_length & 0xFF;
      this.ws.send(new Blob([barr,json,blob]));
    } else {
      this.ws.send(this.encodeString2Message(message));
    }
    G_UI_COM.clearUIState();
    this.reqId ++;
  },

  handleAsyncServerRequest: function(response,noError) {
    this.handleServerFunctionResponse({},noError,response,G_UI_COM.getUIState());
  },
  
  handleSyncServerRequest: function(response) {
    this.handleServerFunctionResponse({},true,response,G_UI_COM.getUIState());
    var messageObj = {
      rId: response.rid,
      rType: 'SR'
    }
    var message = dojo.toJson(messageObj);
    this.ws.send(this.encodeString2Message(message));
  },
  
  handleServerFunctionResponse: function(options, success, response, uiState) {
    if (success) {
      if (response.output!="") {
        var json_result = dojo.fromJson(response.output);
        switch (json_result.actiontype) {
          case 'jsupdate': 
          case 'jsexecute':
            G_UI_COM.restoreUIState(uiState);
            this.updateId = '';
            if (options.cId) {
              this.updateId = options.cId;
            }
            if ((typeof json_result.updateid!='undefined') && (json_result.updateid!='')) {
              this.updateId = json_result.updateid;
            }
            G_UI_COM.clearUpdateArea(json_result.id);
            eval(json_result.action);
            break;
          default:
            console.error('Server Function Error => Unknown action type: ' + json_result.actiontype);
        }
      }
    } else {
    //failure
      console.error('Server Function Error => '+response.cn + '.' + response.fn +  (response.error ? ': ' + response.error : ''));
      if (response.output) {
        var json_result = dojo.fromJson(response.output);
        if (json_result.action) {
          eval(json_result.action);
        }
      }
    }
  },

  wsMessageListener: function(message) {
    var response = dojo.fromJson(this.decodeMessage2String(message.data));  
    if (response.session) {
      this.storeSessionId(response.session);
    }
    if (response.error) {
      this.openReq[response.rid].fn(this.openReq[response.rid].messageObj,false/*success*/,response,this.openReq[response.rid].uiState);
      return;
    }
    switch (response.rtype) {
      case 'E':
        if (this.openReq[response.rid]) {
          this.openReq[response.rid].fn(this.openReq[response.rid].messageObj,false,response,this.openReq[response.rid].uiState);
          delete this.openReq[response.rid];
        } else {
          this.handleAsyncServerRequest(response, false);
        }
        break;
      case 'SR':
        if (this.openReq[response.rid]) {
          this.openReq[response.rid].fn(this.openReq[response.rid].messageObj,true/*success*/,response,this.openReq[response.rid].uiState);
          delete this.openReq[response.rid];
        } else {
          console.error(' Error => Got answer for unknown request id: ' + response.rid);
        }
        break;
      case 'S':
        this.handleSyncServerRequest(response);
        break;
      case 'A':
        this.handleAsyncServerRequest(response,true);
        break;
      default:
        console.error(' Error => Unknown Server Request Type: ' + response.rtype);
        break;
    }
  },
  
  wsCloseListener: function(event) {
    console.log("WS CLOSE " + JSON.stringify(event));
  },
  
  wsErrorListener: function(event) {
    console.log("WS ERROR " + JSON.stringify(event));
  },
  
  wsOpenListener: function(event) {
    console.log("WS OPEN " + JSON.stringify(event));
    this.callServerFunction("FIRMOS","init");
  },
  
  encodeString2Message: function(str) {
   return str;
//   var barr = new Uint8Array(str.length);
//   for (var i = 0; i < str.length; i++) {
//     barr[i] = str.charCodeAt(i);
//   }
//   return barr.buffer;
  },
  
  decodeMessage2String: function(message) {
    return message;
//    var ba = new Uint8Array(message);
//    var str='';
//    for (var i=0; i<ba.length;i++) {
//      str+=String.fromCharCode(ba[i]);
//    }
//    return str;
  },
  
  storeSessionId: function(sessionId) {
    sessionStorage.setItem('sessionId',sessionId);
  },
  
  getSessionId: function() {
    return sessionStorage.getItem('sessionId');
  },
  
  getBinaryDataKey: function() {
    return this.binDataKey++;
  }

});

//uiHandler
dojo.declare("FIRMOS.uiHandler", null, {
  constructor: function(serverCom) {
    this.clearUIState();
    this.dialog_ = new Array();
    this.uiState_ = new Object();
    this.showSectionPathInProgress = false;
    this.stores_ = new Object();
    this.formDBOs_ = new Object();
    this.selDepFuncs_ = {views:{}, classes:{}};
    this.liveCharts_ = new Object();
    this.msgProgress_ = new Object();
    this.createdCSSRules_ = new Object();
    this.serverCom = serverCom;
    this.buttonClickStates_ = {};
    this.sitemap_ = null;
    this.storeDepData = new Object();
  },
  
  refreshView: function(view) {
    if (view.isInstanceOf(FIRMOS.GridBase)) {
      view.refresh();
    } else {
      if (view.isInstanceOf(FIRMOS.Tree)) {
        view.refresh();
      } else {
        console.error('REFRESH VIEW TYPE UNKNOWN');
      }
    }
  },
  
  refreshStore: function(storeId) {
    var store = G_UI_COM.getStoreById(storeId);
    if (store) {
      for (var j=0; j<store.views.length; j++) {
        G_UI_COM.refreshView(store.views[j]);
      }
    }
  },

  setMenu: function(menu) {
    this.menu_ = menu;
  },
  
  isDialogAction: function() {
    this.dialogAction_ = true;
  },
  
  setGridDetailsId: function(id) {
    this.gridDetailsId_ = id;
  },
  
  setDropCoords: function(coords) {
    this.dropCoords_ = coords;
  },
  
  getUIState: function() {
    return {
      dialogAction: this.dialogAction_,
      dialog: this.dialog_,
      menu: this.menu_,
      gridDetailsId: this.gridDetailsId_,
      dropCoords: this.dropCoords_
    };
  },
  clearUIState: function() {
    this.dialogAction_ = false;
    this.menu_ = null;
    this.gridDetailsId_ = null;
    this.dropCoords_ = null;
  },
  
  restoreUIState: function(uiState) {
    this.uiState_ = uiState;
  },
  
  closeDialog: function() {
    if ((this.uiState_.dialog.length>0) && (this.dialog_.length>0)) {
      if (this.uiState_.dialog[this.uiState_.dialog.length-1].id == this.dialog_[this.dialog_.length-1].id) {
        this.dialog_[this.dialog_.length-1].hide(true);
      }
    }
  },
  
  dialogLoaded: function(dialog) {
    if (this.uiState_.dialogAction) {
      this.closeDialog();
    }
    this.dialog_.push(dialog);
    dialog.show();
  },
  
  dialogClosed: function(dialogId) {
    if (this.dialog_[this.dialog_.length]==dialogId) {
      this.dialog_.pop();
    } else {
      var tmpDialog = new Array();
      for (var i=0; i<this.dialog_.length; i++) {
        if (this.dialog_[i].id!=dialogId) {
          tmpDialog[tmpDialog.length] = this.dialog_[i];
        }
      }
      this.dialog_ = tmpDialog;
    }
  },
  
  showMessage: function(message) {
    message.show();
    this.dialog_.push(message);
  },

  setWinTitle: function(winTitle) {
    if (winTitle && winTitle!='') {
      document.title = winTitle;
    }
  },
  
  clearContentArea: function(contentId) {
    this.serverCom.updateId = contentId;
    this.clearUpdateArea('');
    this.contentLoaded(new dijit.layout.ContentPane({}));
  },
  
  clearUpdateArea: function(id) {
    if (id!='') {
      var oldObj = dijit.byId(id);
      if ((this.serverCom.updateId=='') && (oldObj)) {
        this.serverCom.updateId = id;
      }
    }
    if (this.serverCom.updateId!='') {
      if (this.serverCom.updateId == 'FirmOSViewport') {
        var viewport = dojo.byId("FirmOSViewport");
        var widgets = dijit.findWidgets(viewport);
        for (var i=0; i<widgets.length; i++) {
          widgets[i].destroyRecursive();
        }
      } else {
        var panel = dijit.byId(this.serverCom.updateId);
        if (panel) {
          var parent = panel.getParent();
          if ((parent.isInstanceOf(dijit.layout.TabContainer)) || (parent.isTCElem)) {
            return;
          }
          if (panel._contentId) {
            var old_id = panel._contentId;
          } else {
            var old_id = panel.id;
            this.serverCom.updateId = parent.id;
            panel = parent;
          }
          var old_content = dijit.byId(old_id);
          if (old_content) {
            if (old_content.region) {
              panel.updatingRegion_ = old_content.region;
              panel.updatingStyle_ = old_content.style;
            }
            panel.removeChild(old_content);
            old_content.destroyRecursive();
          } 
        }
      }
    }
    oldObj = dijit.byId(id);
    if (oldObj) {
      oldObj.destroyRecursive();
    }
  },
  
  contentLoaded: function(result,winTitle) {
    this.setWinTitle(winTitle);
    if (this.uiState_.dialogAction) {
      this.closeDialog();
    }
    if (this.serverCom.updateId == 'FirmOSViewport') {
      var viewport = dojo.byId("FirmOSViewport");
      result.placeAt(viewport);
      result.startup();
    } else {
      var panel = dijit.byId(this.serverCom.updateId);
      if (panel) {
        var parent = panel.getParent();
        if (panel.updatingRegion_) {
          result.set('region',panel.updatingRegion_);
          delete panel.updatingRegion_;
          result.set('style',panel.updatingStyle_);
          delete panel.updatingStyle_;
        }
        if (panel.isInstanceOf(dijit.layout.ContentPane)) {
          panel.set('content',result);
        } else {
          panel.addChild(result);
        }
        if (panel._contentId) {
          panel._contentId = result.id;
        }
        result.startup();
      } else {
        console.warn('NO CONTENT AREA FOUND FOR ' + result.id);
        result.destroyRecursive();
      }
    }
    this.serverCom.updateId = null;
  },
  
  formProxyLoaded: function(result) {
    console.error('IMPLEMENT ME');
    /*var elem=Ext.getCmp(elementId);
    for (var i=0; i<form.length; i++) {
      elem.add(form[i]);
    }
    elem._firmos_loaded=true;
    elem.expand();*/
  },

  menuLoaded: function(entries) {
    if (entries.length>0) {
      if (this.uiState_.menu) {
        this.uiState_.menu.entriesLoaded(entries);
      } else {
        if (this.uiState_.dropCoords) {
          var menu = new FIRMOS.Menu();
          menu.setCoords(this.uiState_.dropCoords.x,this.uiState_.dropCoords.y);
          menu.entriesLoaded(entries);
        } else {
          //FIXXME: implement default
        }
      }
    }
  },

  updateStore: function(storeId, data) {
    var store = this.getStoreById(storeId);
    if (store) {
      if (data.updated) {
        store.store.updateItems(data.updated);
      }
      if (data.deleted) {
        store.store.deleteItems(data.deleted);
      }
      if (data.new) {
        store.store.newItems(data.new);
      }
    } else {
//      console.warn('Store ' + storeId + ' not registered');
    }
  },
  
  registerStore: function(store) {
    if (this.stores_[store.id]) {
      this.stores_[store.id].store = store;
    } else {
      this.stores_[store.id]={store: store, views: []};
    }
  },
  
  unregisterStore: function(store) {
    delete this.stores_[store.id];
  },
  
  registerFormDBOs: function(form, dboids) {
    if (this.formDBOs_[form.id]) {
      console.error('Form ' + form.id + ' already registered');
    } else {
      this.formDBOs_[form.id] = {form: form, ids: dboids};
    }
  },
  
  unregisterFormDBOs: function(formid, dboids) {
    if (this.formDBOs_[formid]) {
      G_SERVER_COM.callServerFunction("FIRMOS","unregisterDBO",null, {ids: dboids});
      delete this.formDBOs_[formid];
    } else {
      console.error('Form ' + formid + ' not registered');
    }
  },
  
  updateFormDBO: function(obj) {
    for (var x in this.formDBOs_) {
      for (var i=0; i<this.formDBOs_[x].ids.length; i++) {
        if (this.formDBOs_[x].ids[i]==obj.uid) {
          this.formDBOs_[x].form.updateValues(obj);
          break;
        }
      }
    }
  },
  
  updateForm: function(formId, obj) {
    var form = dijit.byId(formId+'_form');
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      form.updateValues(obj);
    }
  },
  
  updateSVG: function(svgId, elementId, attribute, value) {
    var svg = dijit.byId(svgId);
    if (svg && svg.isInstanceOf(FIRMOS.SVG)) {
      svg.updateElement(elementId, attribute, value);
    }
  },
  
  registerSelDepFunc: function(classname, functionname, view) {
    this.selDepFuncs_.views[view.id] = view;
    if (!this.selDepFuncs_.classes[classname]) {
      this.selDepFuncs_.classes[classname] = {};
    }
    if (!this.selDepFuncs_.classes[classname][functionname]) {
      this.selDepFuncs_.classes[classname][functionname] = {viewIds:{}};
    }
    this.selDepFuncs_.classes[classname][functionname].viewIds[view.id] = true;
  },

  unregisterSelDepFunc: function(classname, functionname, view) {
    if ((this.selDepFuncs_.classes[classname]) && (this.selDepFuncs_.classes[classname][functionname])) {
      delete this.selDepFuncs_.classes[classname][functionname].viewIds[view.id];
      if (Object.keys(this.selDepFuncs_.classes[classname][functionname].viewIds).length==0) {
        delete this.selDepFuncs_.classes[classname][functionname].viewIds;
        if (Object.keys(this.selDepFuncs_.classes[classname][functionname]).length==0) {
          delete this.selDepFuncs_.classes[classname][functionname];
          if (Object.keys(this.selDepFuncs_.classes[classname]).length==0) {
            delete this.selDepFuncs_.classes[classname];
          }
        }
      }
    }
    delete this.selDepFuncs_.views[view.id];
  },

  beforeCallServerFunction: function (classname, functionname, uidPath, params) {
    var ret = {};
    if ((this.selDepFuncs_.classes[classname]) && (this.selDepFuncs_.classes[classname][functionname])) {
      var selection = [];
      for (var x in this.selDepFuncs_.classes[classname][functionname].viewIds) {
        var view = this.selDepFuncs_.views[x];
        selection = selection.concat(view.getSelectedIds())
        dojo.mixin(params, view.contentParmas);
      }
      if ((uidPath) || (selection.length==1)) {
        ret.uidPath = uidPath || [selection[0]];
        params.selected = selection;
        ret.params = params;
      } else {
        var cid = dijit.byId(this.parentId).getParent()._contentId;
        if (cid) {
          G_UI_COM.clearContentArea(cid);
        }
        ret.abort = true;;
      }
    }
    return ret;
  },
  
  registerLiveChart: function(chart) {
    this.liveCharts_[chart.id] = chart;
  },
  
  unregisterLiveChart: function(chart) {
    delete this.liveCharts_[chart.id];
  },
  
  updateLiveChart: function(chartId, data, dataIdx) {
    if (this.liveCharts_[chartId]) {
      this.liveCharts_[chartId].setData(data, dataIdx);
    } else {
      console.error('updateLiveChart: ' + chartId + ' chart not found');
    }
  },

  redefineLiveChart: function(chartId, def) {
    if (this.liveCharts_[chartId]) {
      this.liveCharts_[chartId].redefine(def);
    } else {
      console.error('redefineLiveChart: ' + chartId + ' chart not found');
    }
  },

  registerMsgProgress: function(id, msg) {
    this.msgProgress_[id] = msg;
  },
  
  unregisterMsgProgress: function(id) {
    delete this.msgProgress_[id];
  },
  
  updateMsgProgress: function(id, value) {
    if (this.msgProgress_[id]) {
      this.msgProgress_[id].updateProgress(value);
    } else {
      console.error('updateMsgProgress: ' + id + ' message progress not registered');
    }
  },

  registerStoreView: function(storeId, view) {
    if (!this.getStoreById(storeId)) {
      console.error('registerStoreView: ' + storeId + ' store not registered');
      return;
    }
    var view_found = false;
    for (var i=0; i<this.stores_[storeId].views.length; i++) {
      if (this.stores_[storeId].views[i].id == view.id) {
        view_found = true;
        this.stores_[storeId].views[i] = view;
      }
    }
    if (!view_found) {
      this.stores_[storeId].views[this.stores_[storeId].views.length] = view;
    }
  },

  unregisterStoreView: function(storeId, view) {
    if (this.getStoreById(storeId)) {
      for (var i=0; i<this.stores_[storeId].views.length; i++) {
        if (this.stores_[storeId].views[i].id == view.id) {
          this.stores_[storeId].views.splice(i, 1);
          break;
        }
      }
      if (this.stores_[storeId].views.length==0) {
        this.stores_[storeId].store.destroy();
      }
    }
  },
  
  getStore: function(id, storedef) {
    var tmpStore = G_UI_COM.getStoreById(id);
    if (tmpStore) {
      return tmpStore.store;
    } else {
      if (this.storeDepData[id]) {
        storedef._dependency = this.storeDepData[id];
        delete this.storeDepData[id];
      }
      var ret = new FIRMOS.Store(storedef);
      return ret;
    }
  },
  
  setStoreDepData: function(id, depObj) {
    this.storeDepData[id] = depObj;
  },
  
  setStoreDependency: function(storeId, depField, depType, depValues, numDepType) {
    var depObj = new Object();
    depObj.filterfieldname = depField;
    depObj.filtervalues = depValues;
    depObj.filtertype = depType;
    if (numDepType) {
      depObj.numfiltertype = numDepType;
    }
    var store = this.getStoreById(storeId);
    if (store) {
      store.store.params_.dependency[depField + '_ref'] = depObj;
    } else {
      if (!this.storeDepData[storeId]) {
        this.storeDepData[storeId] = new Object();
      }
      this.storeDepData[storeId][depField + '_ref'] = depObj;
    }
  },

  deleteStoreDependency: function(storeId, depField) {
    var store = this.getStoreById(storeId);
    if (store) {
      delete store.store.params_.dependency[depField + '_ref'];
    } else {
      if (this.storeDepData[storeId]) {
        delete this.storeDepData[storeId][depField + '_ref'];
        if (Object.keys(this.storeDepData[storeId]).length==0) {
          delete this.storeDepData[storeId];
        }
      }
    }
  },
  
  getStoreById: function(id) {
    return this.stores_[id];
  },
  
  invalidateSessionData: function(stores) {
    for (var i=0; i<stores.length; i++) {
      var store = this.getStoreById(stores[i].storeid).store;
      if (stores[i].queryids) {
        if (!(stores[i].queryids instanceof Array)) {
          stores[i].queryids = [stores[i].queryids];
        }
        for (var j=0; i<stores[j].queryids.length; j++) {
          store.invalidateObserver(stores[i].queryids[j]);
        }
      } else {
        store.invalidateAllObservers();
      }   
    }
  },
  
  sortFuncSubSecOrd: function(a,b) {
    if (a._subSecOrd<b._subSecOrd) {
      return -1;
    } else {
      if (a._subSecOrd>b._subSecOrd) {
        return 1;
      } else {
        return 0;
      }
    }  
  },
  
  createCSSRule: function(ruleName, rule) {
    if (!this.createdCSSRules_[ruleName]) {
      dojox.html.insertCssRule('.'+ruleName,rule);
      this.createdCSSRules_[ruleName] = rule;
    }
  },
  
  removeCSSRule: function(ruleName) {
    if (this.createdCSSRules_[ruleName]) {
      dojox.html.removeCssRule('.'+ruleName,this.createdCSSRules_[ruleName]);
      delete this.createdCSSRules_[ruleName];
    }
  },

  toggleFormGroupStatus: function(formId,gId) {
    var tl = dojo.byId(gId+'_tl');
    var tr = dojo.byId(gId+'_tr');
    if (dojo.hasClass(tl,"firmosFormGroupShowLeft")) {
      var displayStyle = '';
      dojo.removeClass(tl,"firmosFormGroupShowLeft");
      dojo.removeClass(tr,"firmosFormGroupShowRight");
      dojo.addClass(tl,"firmosFormGroupHideLeft");
      dojo.addClass(tr,"firmosFormGroupHideRight");
    } else {
      var displayStyle = 'none';
      dojo.removeClass(tl,"firmosFormGroupHideLeft");
      dojo.removeClass(tr,"firmosFormGroupHideRight");
      dojo.addClass(tl,"firmosFormGroupShowLeft");
      dojo.addClass(tr,"firmosFormGroupShowRight");
    }
    var form = dojo.byId(formId);
    var trs=dojo.query('tr[firmosGroup~="'+gId+'"]',form);
    for (var i=0; i<trs.length; i++) {
      dojo.style(trs[i],'display',displayStyle);
    }
  },
  
  addMenuEntries: function(menu,entries,disabled) {
    var all_disabled = true;
    for (var i=0; i<entries.length; i++) {
      var cParams = {};
      cParams.label = entries[i].caption;
      cParams.disabled = entries[i].disabled || disabled;
      if (entries[i].icon) {
        var rName = entries[i].icon.replace(/[\/\.]/g,'');
        G_UI_COM.createCSSRule(rName,"background-image: url('"+entries[i].icon+"');background-repeat: no-repeat; height: 18px;text-align: center;width: 18px;");
        cParams.iconClass = rName;
      }
      if (entries[i].menu) {
        var mParams = {};
        if (entries[i].id) {
          mParams.id = entries[i].id;
        }
        var subMenu = new dijit.Menu(mParams);
        cParams.disabled = this.addMenuEntries(subMenu,entries[i].menu,cParams.disabled) || cParams.disabled;
        cParams.popup = subMenu;
        var subMenuEntry = new dijit.PopupMenuItem(cParams);
        subMenu._parentUIElement = subMenuEntry;
        menu.addChild(subMenuEntry);
      } else {
        if (entries[i].id) {
          cParams.id = entries[i].id;
        }
        if (entries[i].action) {
          cParams._action = entries[i].action;
          cParams.onClick = function() {
            G_SERVER_COM.callServerFunction(this._action.class,this._action.func,this._action.uidPath,this._action.params);
          };
        }
        if (entries[i].downloadId) {
          cParams._downloadId = entries[i].downloadId;
          cParams.onClick = function() {
            dojo.io.iframe.setSrc(dojo.byId('FirmOSDownload'),this._downloadId,true);
          }
        }
        menu.addChild(new dijit.MenuItem(cParams));
      }
      all_disabled = all_disabled && cParams.disabled;
    }
    return all_disabled;
  },
  
  _handleTabContainer: function(child, baseContainer, sectionIds, toggleMultiContainer) {
    sectionIds.shift();
    if (sectionIds.length>0) {
      var lastSection = (sectionIds.length==1);
      if (!this.showSectionPath(child, sectionIds, toggleMultiContainer)) {
        console.error('Could not resolve given sub section path: container: ' + child.id + ', sections: ' + JSON.stringify(sectionIds));
      }
      if (lastSection) {
        G_UI_COM.showSectionPathInProgress = false;
      }
    } else {
      if (toggleMultiContainer) { //toggle if the leaf is a multi container, the path was selected and toggle was enabled
        var subChild = child.getChildren()[0];
        if (subChild && subChild.isInstanceOf(FIRMOS.MultiContentContainer)) {
          var children = subChild.getChildren();
          for (var i=0; i<children.length; i++) {
            if (children[i].id == subChild.selectedChildWidget.id) {
              if (i==children.length - 1) {
                subChild.selectChild(children[0].id);
              } else {
                subChild.selectChild(children[i+1].id);
              }
              break;
            }
          }
        }
      }
    }
  },
  
  showSectionPath: function(baseContainer, sectionIds, toggleMultiContainer) {
    if (typeof baseContainer=='string') {
      if (baseContainer=='FirmOSViewport') {
        var viewport = dojo.byId('FirmOSViewport');
        var container = dijit.byId(viewport.children[0].id);
      } else {
        var container = dijit.byId(baseContainer);
      }
      if (!container) {
        console.error('Base container "'+baseContainer+'" not found.');
      }
    } else {
      var container = baseContainer;
    }

    if (container.isInstanceOf(dijit.layout.ContentPane)) {
      if (container.hasChildren()) {
        return this.showSectionPath(container.getChildren()[0], sectionIds, toggleMultiContainer);
      } else {
        return false;
      }
    }

    if (container.isInstanceOf(dijit.layout.BorderContainer)) {
      var children = container.getChildren();
      for (var i=0; i<children.length; i++) {
        if (this.showSectionPath(children[i],sectionIds,toggleMultiContainer)) {
          return true;
        }
      }
      return false;
    }

    if (container.isInstanceOf(FIRMOS.TabContainer)) {
      var child = container.getChild(sectionIds[0]);
      if (child) {
        toggleMultiContainer = toggleMultiContainer && (container.selectedChildWidget.id==sectionIds[0]);
        container.selectChild(child,this._handleTabContainer.bind(this,child,baseContainer,sectionIds,toggleMultiContainer));
        return true;
      } else {
        container.selectDefault();
        return false;
      }
    }
  },
  
  registerSitemap: function(sitemap) {
    this.sitemap_ = sitemap;
  },
  
  unregisterSitemap: function(sitemap) {
    delete this.sitemap_;
  },
  
  _updateElement: function(element,disabled) {
     element.set('disabled',disabled);
     if (element._parentUIElement) {
       element._parentUIElement.set('disabled',disabled);
     }
  },
  
  _updateChildElements: function(element,disabled) {
    if (element.isInstanceOf(dijit.Menu) || element.isInstanceOf(dijit.DropDownMenu) || element.isInstanceOf(dijit.PopupMenuItem)) { 
      if (element.isInstanceOf(dijit.PopupMenuItem)) {
        var children = element.popup.getChildren();
      } else {
        var children = element.getChildren();
      }
      for (var i=0; i<children.length; i++) {
        this._updateElement(children[i],disabled);
        this._updateChildElements(children[i],disabled);
      }
    }
  },
  
  _updateParent: function(element) {
    if (element._parentUIElement) {
      var parent = element._parentUIElement.getParent();
    } else {
      var parent = element.getParent();
    }
    if (parent.isInstanceOf(dijit.Menu) || parent.isInstanceOf(dijit.DropDownMenu)) {
      var children = parent.getChildren();
      var all_disabled = true;
      for (var i=0; i<children.length; i++) {
        if (!children[i].get('disabled')) {
          all_disabled = false;
          break;
        }
      }
      if (parent.get('disabled')!=all_disabled) {
        this._updateElement(parent,all_disabled);
        this._updateParent(parent);
      }
    }
  },
  
  updateGridDrag: function(elementId,disabled) {
    var element = dijit.byId(elementId + '_grid');
    if (element) {
      element.dndDisabled = disabled;
    }
  },

  updateUIElement: function(elementId,disabled,newCaption,newHint) {
    var element = dijit.byId(elementId);
    if (element) {
      this._updateElement(element,disabled);
      if (newCaption!='') {
        element.set('label',newCaption);
      }
      if (newHint) {
        var hint = dijit.byId(elementId + '_tooltip');
        if (hint) {
          var displayNode = hint.displayedFor();
          hint.set('label',newHint);
          if (displayNode) {
            hint.close();
            hint.open(displayNode);
          }
        }
      }
      this._updateChildElements(element,disabled);
      this._updateParent(element);
    }
  },
  
  updateUIElementSubmenu: function(elementId, menuDef) {
    var element = dijit.byId(elementId);
    if (element) {
      element.destroyDescendants();
      var disabled = G_UI_COM.addMenuEntries(element,menuDef,element.get('disabled'));
      this._updateElement(element,disabled);
    }
  },
  
  openUrl: function(url,newWindow) {
    if (newWindow) {
      var win = window.open(url);
      if (!win) alert(G_TEXTS.openWindow.error);
    } else {
      document.location.href = url;
    }
  }
});

G_SERVER_COM =  new FIRMOS.wsConnectionHandler();
G_UI_COM = new FIRMOS.uiHandler(G_SERVER_COM);

//Dialog
dojo.declare("FIRMOS.Dialog", dijit.Dialog, {
  postCreate: function() {
    this.inherited(arguments);
    if (this._contentObj) {
      var height = this._maxHeight;
      var width = this._maxWidth;
      var pos = dojo.domGeo.position(document.body);
      if ((this._percHeight==0) && (height==0)) {
        this._percHeight = 80;
      } 
      if ((this._percWidth==0) && (width==0)) {
        this._percWidth = 80;
      } 
      if (this._percHeight!=0) {
        height = this._percHeight / 100 * pos.h;
      }
      if (this._percWidth!=0) {
        width = this._percWidth / 100 * pos.w;
      }
      
      var content = dijit.layout.BorderContainer({});
      content.set('style','height: '+height+'px; width: '+width+'px;');
      this._contentObj.set('region','center');
      content.addChild(this._contentObj);
      
     if (this._buttonDef) {
       this._buttonsCP = dijit.layout.ContentPane({content: this._buttonDef, region: 'bottom', style:'text-align:center;'});
       content.addChild(this._buttonsCP);
     }
     this.set('content',content);

    }
  },
  disableAllButtons: function() {
    if (this._buttonsCP) {
      var children = this.getDescendants();
      for (var i=0; i<children.length; i++) {
        if (children[i].isInstanceOf(FIRMOS.FormButton)) {
          children[i]._orgState = children[i].get('disabled');
          children[i].set('disabled',true);
        }
      }
    }
  },
  
  restoreAllButtons: function() {
    if (this._buttonsCP) {
      var children = this.getDescendants();
      for (var i=0; i<children.length; i++) {
        if (children[i].isInstanceOf(FIRMOS.FormButton)) {
          children[i].set('disabled',children[i]._orgState);
          delete children[i]._orgState;
        }
      }
    }
  },
  onShow: function() {
    if (!this.closable) {
      dojo.style(this.closeButtonNode, "display", "none");
    }
  },
  hide: function(forceHide) {
    if (this.closable || forceHide) {
      G_UI_COM.dialogClosed(this.id);
      this.destroyRecursive();
    }
  }
});

//Message
dojo.declare("FIRMOS.Message", FIRMOS.Dialog, {
  texts: G_TEXTS.msg,
  closable: false,
  destroy: function() {
    if (this.progressBarId) {
      G_UI_COM.unregisterMsgProgress(this.progressBarId);
    }
    this.inherited(arguments);
  },
  postCreate: function() {
    this.inherited(arguments);
    var CSSPostFix;
    switch (this.type) {
      case 'msg_error'  : CSSPostFix='Error';
      case 'msg_warning': CSSPostFix='Info';
      case 'msg_info'   : CSSPostFix='Confirm';
      case 'msg_confirm': CSSPostFix='Warning';
      case 'msg_wait'   : CSSPostFix='Wait';
    }
    var content = '<div class="firmosMessageIcon'+CSSPostFix+'"></div><div class="firmosMessage'+CSSPostFix+'">'+this.msg+'</div>';
    if (this.progressBarId) {
      content = content + '<div class="firmosMessageProgressBar" id="'+this.id+'_pb"></div>';
    }
    content = content + '<div class="firmosMessageButtons'+CSSPostFix+'" id="'+this.id+'_buttons"></div>';
    this.set('content',content);
    switch (this.type) {
      case 'msg_error'  :
      case 'msg_warning':
      case 'msg_info'   :
        var button = new dijit.form.Button({type: 'button',
                                            label: this.texts.ok,
                                            onClick: this._onClick.bind(this)
                                           });
        button.placeAt(dojo.byId(this.id+'_buttons'));
        break;
      case 'msg_confirm':
        var button = new dijit.form.Button({type: 'button',
                                            label: this.texts.yes,
                                            onClick: this._onClick.bind(this,true)
                                           });
        button.placeAt(dojo.byId(this.id+'_buttons'));
        var button = new dijit.form.Button({type: 'button',
                                            label: this.texts.no,
                                            onClick: this._onClick.bind(this,false)
                                           });
        button.placeAt(dojo.byId(this.id+'_buttons'));
        break;
      case 'msg_wait'   :
        if (this.sfClassname) {
          var button = new dijit.form.Button({type: 'button',
                                              label: this.texts.abort,
                                              onClick: this._onClick.bind(this)
                                             });
          button.placeAt(dojo.byId(this.id+'_buttons'));
        }
        break;
    }

    if (this.progressBarId) {
      G_UI_COM.registerMsgProgress(this.progressBarId,this);
      this._pb = new dijit.ProgressBar({style: "width: 100%"});
      this._pb.set("value",0);
      this._pb.set('label','0%');
      this._pb.placeAt(dojo.byId(this.id+'_pb'));
    }
  },
  updateProgress: function(value) {
    this._pb.set('value',value);
    this._pb.set('label',Math.round(value)+'%');
  },
  _onClick: function(confirmed) {
    this.hide(true);
    if (this.sfClassname) {
      var params = dojo.clone(this.sfParams);
      if (typeof confirmed == 'boolean') {
        params.confirmed = confirmed;
      }
      G_SERVER_COM.callServerFunction(this.sfClassname,this.sfFunctionname,this.sfUidPath,params);
    }
  }
});

//Store
dojo.declare("FIRMOS.Store", null, {

  idAttribute: 'uid',
  labelAttributes: ['text','objname','uid'],

  constructor: function(args) {
    this.params_ = new Object();
    if (args._dependency) {
      this.params_.dependency = args._dependency;
      delete args._dependency;
    } else {
      this.params_.dependency = new Object();
    }
    for (var i in args) {
      this[i] = args[i];
    }

    this._index = {};
    this._dirtyItems = {};
    this._orgItems = {};
    this.queryId_ = 0;
    this.queryResults_ = new Object();
    G_UI_COM.registerStore(this);
  },
  destroy: function() {
    if (this.destroyClassname) {
      G_SERVER_COM.callServerFunction(this.destroyClassname, this.destroyFunctionname, this.destroyUidPath, this.destroyParams);
    }
    G_UI_COM.unregisterStore(this);
    G_UI_COM.setStoreDepData(this.id,this.params_.dependency);
    this.inherited(arguments);
  },
  close: function(request) {
    return request && request.abort && request.abort();
  },
  containsValue: function(item, attribute, value) {
    return dojo.array.indexOf(this.getValues(item,attribute),value) > -1;
  },
  mayHaveChildren: function(object) {
    if (object.children) {
      return true;
    } else {
      return false;
    }
  },
  _getChildrenCallback: function(item,callback,results) {
    item.children = results;
    for (var i=0; i<item.children.length; i++) {
      this._addToIndex(item.children[i],this.getIdentity(item));
      if ((item.children[i].children) && (item.children[i].children=='UNCHECKED')) {
        item.children[i].children = [];
        item.children[i]._loadChildren = true;
      }
    }
    if (typeof callback == 'function') {
      callback(item);
    }
  },
  getChildren: function(item,args) {
    var argsIsCallback = (typeof args == 'function');
    var query_args = {};
    
    if (!argsIsCallback) {
      query_args = args;
    }
    var def = this._doQuery(query_args,item);
    def.addCallback(this._getChildrenCallback.bind(this,item,args));
    if (argsIsCallback) {
      def.addErrback(args.bind(this,new Error('Error in function getChildren')));
    }
    return dojo.store.util.QueryResults(def);
  },
  query: function(query, args) {
    args.query = query;
    var def = this._doQuery(args);
    return dojo.store.util.QueryResults(def);
  },
  _doQuery: function(args,item) {
    var def=new dojo.Deferred();

    var query_id = this.queryId_++;
    this.queryResults_[query_id] = new Object();
    this.queryResults_[query_id].query = args.query;
    this.queryResults_[query_id].queryArgs = args;
    this.queryResults_[query_id].dataIds = new Array();
    this.queryResults_[query_id].observer = new Array();
    this.queryResults_[query_id].observerInfo = new Array();
    this.queryResults_[query_id].parentId = '';

    var params = dojo.clone(this.getParams);
    dojo.mixin(params, this.params_);
    
    if (item) {
      var id = this.getIdentity(item);
      this.queryResults_[query_id].parentId = id;
      params.parentid = id;
    }
    if ((item) && (item._childrenfunc_)) {
      var cn = item._funcclassname_ || this.getClassname;
      var fn = item._childrenfunc_;
      if (item.uidpath) {
        if (item.uidpath instanceof Array) {
          var up = item.uidpath;
        } else {
          var up = [item.uidpath];
        }
      } else {
        var up = [item.uid];
      }
    } else {
      var up = this.getUidPath;
      var cn = this.getClassname;
      var fn = this.getFunctionname;
    }

    params.queryid = query_id;
    if (args.query) {
      params.query = args.query;
    }
    if (typeof args.count!="undefined") params.count = args.count;
    if (typeof args.start!="undefined") params.start = args.start;
    if (args.sort) {
      params.sort = new Array();
      for (var i=0;i<args.sort.length;i++) {
        params.sort[i] = new Object();
        params.sort[i].property = args.sort[i].attribute;
        params.sort[i].ascending = !args.sort[i].descending;
      }
    }

    def.total = new dojo.Deferred();
    def.observe = this._observe.bind(this, query_id); 
    var serverFuncCallback = function(queryId, options, success, response) { 
      if (success) {
        var json_result = dojo.fromJson(response.output);
        if (json_result.actiontype && (json_result.actiontype=='jsexecute')) {
          def.reject();
          eval(json_result.action);
        } else {
          def.total.resolve(json_result.total);
          if (this.queryResults_[queryId]) {
            //store ids of the result
            for (var i=0; i<json_result.data.length; i++) {
              this.queryResults_[queryId].dataIds.push(this.getIdentity(json_result.data[i]));
            }
            if (this.queryResults_[queryId].observer.length==0) {
              setTimeout(this._deleteResultCache.bind(this,queryId),2000);
            }
          }
          def.resolve(json_result.data);
        }
      } else {
        def.reject(response.error);
      }
    }.bind(this, query_id);
    G_SERVER_COM.callServerFunction(cn, fn, up, params, serverFuncCallback);

    return def;
  },
  _fetchTotalCountCallback: function(args,scope,results) {
    if (args.onBegin) {
      args.onBegin.call(scope, results, args);
    }
  },
  _addToIndex: function(item,parentId) {
    if (!this._index[this.getIdentity(item)]) {
      this._index[this.getIdentity(item)] = new Array();
    }
    this._index[this.getIdentity(item)].push(parentId);
  },
  _isInIndex: function(item,parentId) {
    var found = false;
    var itemId = this.getIdentity(item);
    if (this._index[itemId]) {
      for (var i=0; i<this._index[itemId].length; i++) {
        if (this._index[itemId][i]==parentId) {
          found = true;
          break;
        }
      }
    }
    return found;
  },
  _fetchCallback: function(args,scope,results) {
    for (var i=0;i<results.length;i++) {
      this._addToIndex(results[i],'');
    }
    if (args.onItem) {
      for (var i=0; i<results.length;i++){
        args.onItem.call(scope, results[i], args);
      }
    }
    if (args.onComplete) {
      args.onComplete.call(scope, args.onItem ? null : results, args);
    }
  },
  fetch: function(args){
    args = args || {};
    var scope = args.scope || this;
    var def = this._doQuery(args);
    def.request = args;
    def.addCallback(this._fetchCallback.bind(this,args,scope));
    def.total.addCallback(this._fetchTotalCountCallback.bind(this,args,scope));
    if (args.onError) {
      def.addErrback(function(err) { return args.onError.call(scope, err, args); });
    }
    args.abort = function() { def.cancel(); };
    return args;
  },
  getAttributes: function(item){
    var res = [];
    for (var i in item){
      if (item.hasOwnProperty(i) && !(i.charAt(0) == '_' && i.charAt(1) == '_')) {
        res.push(i);
      }
    }
  return res;
  },
  getFeatures: function(){
    return {
      "dojo.data.api.Read": true,
      "dojo.data.api.Identity": true,
      "dojo.data.api.Write": true,
      "dojo.data.api.Notification": true
    };
  },
  getLabel: function(item){
    for (var i=0; i<this.labelAttributes.length; i++) {
      var l=this.getValue(item,this.labelAttributes[i]);
      if (l) return l;
    }
    for (var i in item) {
      return item[i];
    }
  },
  getLabelAttributes: function(item){
    return this.labelAttributes;
  },
  getValue: function(item, property, defaultValue){
    if (property in item) {
      return item[property];
    }
    if (item._loadChildren && (property=='children')) {
      return;
    }
    return defaultValue;
  },
  getValues: function(item, property){
    var val = this.getValue(item,property);
    return val instanceof Array ? val : val === undefined ? [] : [val];
  },
  hasAttribute: function(item,attribute){
    return attribute in item;
  },
  isItem: function(item){
    return (typeof item == 'object') && item && (this.getIdentity(item)!=undefined);
  },
  isItemLoaded: function(item){
    return item && !item._loadChildren;
  },
  _loadItemCallback: function(args, result) {
    var scope = args.scope || this;
    delete result._loadChildren;
    var func = result instanceof Error ? args.onError : args.onItem;
    if (func) {
      func.call(scope, result);
    }
  },
  loadItem: function(args){
    var scope = args.scope || this;
    if (args.item._loadChildren){
      this.getChildren(args.item, this._loadItemCallback.bind(this,args));
    } else {
      if (args.onItem){
        args.onItem.call(scope, args.item);
      }
    }
  },
  deleteItem: function(item) {
    console.error('STORE DELETE NOT IMPLEMENTED: ' + JSON.stringify(item));
    return true;
  },
  isDirty: function(item) {
    if (this._dirtyItems[this.getIdentity(item)]) {
      return true;
    } else {
      return false;
    }
  },
  newItem: function(data, parentInfo) {
    console.error('STORE NEW ITEM NOT IMPLEMENTED: ' + JSON.stringify(data) + ' - ' + JSON.stringify(parentInfo));
    return data;
  },
  revert: function() {
    for (var i in this._dirtyItems) {
      for (var x in this._dirtyItems[i]) {
        if (this._orgItems[i][x] != this._dirtyItems[i][x]) {
          this.onSet(this._orgItems[i],x,this._dirtyItems[i][x],this._orgItems[i][x]);
        }
      }
      delete this._dirtyItems[i];
      delete this._orgItems[i];
    }
  },
  save: function(args) {
    console.error('SAVE ITEM NOT IMPLEMENTED: ' + JSON.stringify(args));
    var scope = args.scope || this;
    for (var i in this._dirtyItems) {
      //SEND SAVE TO SERVER
      delete this._dirtyItems[i];
      delete this._orgItems[i];
    }
    if (args.onComplete) {
      args.onComplete.call(scope, args);
    }
  },
  setValue: function(item, attribute, value) {
    if (attribute==this.idAttribute) {
      throw new Error("Can not change the identity attribute for an item");
    }
    var old = item[attribute];
    if (old!=value) {
      if (!this._orgItems[this.getIdentity(item)]) {
        this._orgItems[this.getIdentity(item)] = dojo.clone(item);
      }
      if (value) {
        item[attribute]=value;
      } else {
        delete item[attribute];
      }
      this._dirtyItems[this.getIdentity(item)] = item;
      this.onSet(item,attribute,old,value);
    }
  },
  setValues: function(item, attribute, values){
    if(!lang.isArray(values)){
      throw new Error("setValues expects to be passed an Array object as its value");
    }
    this.setValue(item,attribute,values);
  },
  unsetAttribute: function(item, attribute){
    this.setValue(item,attribute);
  },
  onSet: function(item, attribute, oldValue, newValue) {},
  onNew: function(newItem, parentInfo) {},
  onDelete: function(deletedItem) {},
  fetchItemByIdentity: function(args){
    return this.fetch({query: this.idAttribute + '=' + args.identity, onComplete: args.onItem, onError: args.onError, scope: args.scope});
  },
  getIdentity: function(object){
    return object[this.idAttribute];
  },
  getIdentityAttributes: function(item){
    return [this.idAttribute];
  },
  _observe: function(queryId, listener, includeObjectUpdates, chartId) {
    var handle = {};
    handle.listener = listener;
    handle.remove = handle.cancel = this._removeObserver.bind(this, handle);
    handle.queryId = queryId;
    this.queryResults_[queryId].observer.push(listener);
    this.queryResults_[queryId].observerInfo.push(chartId || '');
    return handle;
  },
  invalidateObserver: function(queryId) {
    delete this.queryResults_[queryId];
  },
  invalidateAllObservers: function() {
    for (var i in this.queryResults_) {
      delete this.queryResults_[i];
    }
  },
  _removeObserver: function(handle) {
    if (this.queryResults_[handle.queryId]) {
      var index = dojo.array.indexOf(this.queryResults_[handle.queryId].observer, handle.listener);
      if(index>-1) {
        this.queryResults_[handle.queryId].observer.splice(index, 1);
        this.queryResults_[handle.queryId].observerInfo.splice(index, 1);
      }
    }
    this._deleteResultCache(handle.queryId);
  },
  _deleteResultCache: function(queryId) {
    if (this.queryResults_[queryId] && (this.queryResults_[queryId].observer.length==0)) {
      if (this.clearClassname) {
        var params = this.clearParams;
        params.queryid = queryId;
        G_SERVER_COM.callServerFunction(this.clearClassname, this.clearFunctionname, this.clearUidPath, params);
      }
      delete this.queryResults_[queryId];
    }
  },
  get: function(itemId) {
    var ret = {};
    ret[this.idAttribute]=itemId;
    return ret;
  },
  remove: function(itemId) { //drag operation
    if (this.dragClassname) {
      var params = dojo.clone(this.dragParams);
      dojo.mixin(params, this.params_);
      params.selected = itemId;
      G_SERVER_COM.callServerFunction(this.dragClassname,this.dragFunctionname,this.dragUidPath, params);
    }
  },
  put: function(items, args) {  //drop operation (args: {source: store, before: item})
    //console.log('PUT ' + JSON.stringify(items) + ' - ' + JSON.stringify(args));
    if (this.dropClassname) {
      var params = dojo.clone(this.dropParams);
      dojo.mixin(params, this.params_);
      params.selected = [];
      for (var i=0; i<items.length; i++) {
        params.selected.push(this.getIdentity(items[i]));
      }
      if (args.before) {
        if (args.source) {
          params.target = args.source.getIdentity(args.before);
        } else {
          params.target = this.getIdentity(args.before);
        }
      }
      if (args.mousePos) {
        G_UI_COM.setDropCoords(args.mousePos);
      }
      G_SERVER_COM.callServerFunction(this.dropClassname,this.dropFunctionname,this.dropUidPath, params);
    }
  },
//FIRMOS update API
  _findItemInResultSets: function(itemId) {
    var res = [];
    for (var q in this.queryResults_) {
      for (var c=0; c<this.queryResults_[q].dataIds.length; c++) {
        if (this.queryResults_[q].dataIds[c]==itemId) {
          res.push({queryId: q, pos: c});
          break;
        }
      }
    }
    return res;
  },
  _findChildrenCallResultSets: function(parentId) {
    var res = [];
    for (var q in this.queryResults_) {
      if (this.queryResults_[q].parentId==parentId) {
        res.push({queryId: q});
      }
    }
    return res;
  },
  _removeChildrenQuerys: function(itemId) {
    for (var q in this.queryResults_) {
      if (this.queryResults_[q].parentId==itemId) {
        for (var i=0; i<this.queryResults_[q].dataIds.length; i++) {
          this._removeChildrenQuerys(this.queryResults_[q].dataIds[i]);
        }
        delete this.queryResults_[q];
      }
    }
  },
  newItems: function(data) {
    for (var i=0;i<data.length;i++) {
      var qpos = this._findItemInResultSets(this.getIdentity(data[i].item));
      if ((qpos.length>0) || (this._isInIndex(data[i].item,data[i].parentid))) {
        console.error('NEW ITEMS: Item ' + this.getIdentity(data[i].item) + ' already in store ('+this.id+')!');
        continue;
      }
      var pq = this._findChildrenCallResultSets(data[i].parentid);
      if (pq.length==0) {
        console.warn('NEW ITEMS: Parent ' + data[i].parentid + ' not found or no children retrieved yet in store ' + this.id + '!');
        continue;
      }
      
      if (data[i].revid!='') {
        var revIdNotFound = true;
        var qpos = this._findItemInResultSets(data[i].revid);
        if (qpos.length>0) {
          for (var q=0; q<qpos.length; q++) {
            if (data[i].parentid!=this.queryResults_[qpos[q].queryId].parentId) {
              console.warn('RevId ' + data[i].revid + ' found in query for wrong parent item (Found in: ' + this.queryResults_[qpos[q].queryId].parentId + '  Defined parent: '+ data[i].parentid+')');
              continue; //skip queries for the 'wrong' parent
            }
            revIdNotFound = false;
            var found_count = this.queryResults_[qpos[q].queryId].observer.length;
            for (var o=0; o<found_count; o++) {
              if (data[i].revisprev) {
                qpos[q].pos = qpos[q].pos + 1;
              }
              this.queryResults_[qpos[q].queryId].dataIds.splice(qpos[q].pos,0,this.getIdentity(data[i].item));
              this.queryResults_[qpos[q].queryId].observer[o](data[i].item,-1,qpos[q].pos);
            }
          }
        }
        if (this._index[data[i].revid]) {
          revIdNotFound = false;
          this._addToIndex(data[i].item,data[i].parentid);
          this.onNew(data[i].item);
        }
        if (revIdNotFound) {
          if (data[i].parentid!='') {
            console.warn('RevId ' + data[i].revid + ' not found in any query for parent item ' + data[i].parentid + ' in store ' + this.id);
          } else {
            console.warn('RevId ' + data[i].revid + ' not found in any query for store ' + this.id);
          }
        }
      } else {
        //add to first queries at the beginning
        for (var q in this.queryResults_) {
          if (data[i].parentid!=this.queryResults_[q].parentId) {
            continue; //skip queries for the 'wrong' parent
          }
          for (var o=0; o<this.queryResults_[q].observer.length; o++) {
            this.queryResults_[q].dataIds.unshift(this.getIdentity(data[i].item));
            this.queryResults_[q].observer[o](data[i].item,-1,0);
          }
          break;
        }
        this._addToIndex(data[i].item,data[i].parentid);
        this.onNew(data[i].item);
      }
    }
  },
  deleteItems: function(itemIds) {
    for (var i=0;i<itemIds.length;i++) {
      var notFound = true;
      var tmpData = new Object();
      tmpData[this.idAttribute] = itemIds[i];
      var qpos = this._findItemInResultSets(itemIds[i]);
      if (qpos.length>0) {
        notFound = false;
        for (var q=0; q<qpos.length; q++) {
          this._removeChildrenQuerys(itemIds[i]);
          this.queryResults_[qpos[q].queryId].dataIds.splice(qpos[q].pos,1);
          var found_count = this.queryResults_[qpos[q].queryId].observer.length;
          for (var o=0; o<found_count; o++) {
            this.queryResults_[qpos[q].queryId].observer[o](tmpData,qpos[q].pos,-1);
          }
        }
      }
      if (this._index[itemIds[i]]) {
        notFound = false;
        delete this._index[itemIds[i]];
        this.onDelete(tmpData);
      }
      if (notFound) {
        console.warn('DeleteId ' + itemIds[i] + ' not found in any query for store ' + this.id);
      }
    }
  },
  updateItems: function(data) {
    var chartUpdates = [];
    for (var i=0; i<data.length; i++) {
      var notFound = true;
      var qpos = this._findItemInResultSets(this.getIdentity(data[i]));
      if (qpos.length>0) {
        notFound = false;
        for (var q=0; q<qpos.length; q++) {
          var found_count = this.queryResults_[qpos[q].queryId].observer.length;
          for (var o=0; o<found_count; o++) {
            if (this.queryResults_[qpos[q].queryId].observerInfo[o]) {
              var views = G_UI_COM.getStoreById(this.id).views;
              for (var v=0; v<views.length; v++) {
                if (views[v].id == this.queryResults_[qpos[q].queryId].observerInfo[o]) {
                  var adapters = views[v].storeAdapters_;
                  for (var j=0; j<adapters.length; j++) {
                    if (adapters[j].series.name==this.queryResults_[qpos[q].queryId].query.sId) {
                      adapters[j].objects[qpos[q].pos].value = data[i].value;
                      break;
                    }
                  }
                  break;
                }
              }
              if (dojo.array.indexOf(chartUpdates, this.queryResults_[qpos[q].queryId].observer[o])==-1) {
                chartUpdates.push(this.queryResults_[qpos[q].queryId].observer[o]);
              }
            } else {
              this.queryResults_[qpos[q].queryId].observer[o](data[i],qpos[q].pos,qpos[q].pos); //FIXXME - update and reorder!?!
            }
          }
        }
      }
      if (this._index[this.getIdentity(data[i])]) {
        notFound = false;
        for (var x in data[i]) {
          if (x==this.idAttribute) continue; //skip id attribute
          this.onSet(data[i],x,'',data[i][x]);
        }
      }
      if (notFound) {
        console.warn('UpdateId ' + this.getIdentity(data[i]) + ' not found in any query for store ' + this.id);
      }
    }  
    for (var i=0; i<chartUpdates.length; i++) {
      chartUpdates[i]();
    }
  }
});

//Tree
dojo.declare("FIRMOS.Tree", dijit.Tree, {
  constructor: function(args) {
    G_UI_COM.registerStoreView(args.model.store.id,this);
  },
  destroy: function() {
    G_UI_COM.unregisterStoreView(this.model.store.id,this);
    this.inherited(arguments);
  },
  postCreate: function() {
    this.watch("selectedItems",this.selectionChanged.bind(this));
    this.inherited(arguments);
  },
  getIconClass: function(item, opened) {
    if (item._icon_) {
      var rName = item._icon_.replace(/[\/\.]/g,'');
      G_UI_COM.createCSSRule(rName,"background-image: url('"+item._icon_+"');background-repeat: no-repeat; height: 18px;text-align: center;width: 18px;");
      return rName;
    } else {
      return this.inherited(arguments);
    }
  },
  selectionChanged: function(property,oldValue,newValue) {  //FIXXME - register content funcs for trees
    if (newValue && newValue.length>0) {
      if (newValue[0]._funcclassname_ && newValue[0]._contentfunc_) {
        var contentFunc={};
        contentFunc.classname = newValue[0]._funcclassname_;
        contentFunc.functionname = newValue[0]._contentfunc_;
        if (newValue[0].uidpath) {
          if (newValue[0].uidpath instanceof Array) {
            contentFunc.uidPath = newValue[0].uidpath;
          } else {
            contentFunc.uidPath = [newValue[0].uidpath];
          }
        } else {
          contentFunc.uidPath = [newValue[0].uid];
        }
      }
      if (contentFunc) {
        G_SERVER_COM.callServerFunction(contentFunc.classname,contentFunc.functionname,contentFunc.uidPath, null, null, dijit.byId(this.parentId).getParent()._contentId || null);
      }
    }
  },
  refresh: function() {
    this.dndController.selectNone();

    this.model.store.clearOnClose = true;
    this.model.store.close();

    this._itemNodesMap = {};
    this.rootNode.state = "UNCHECKED";
    this.model.root.children = null;
    this.rootNode.destroyRecursive();
    this.model.constructor(this.model);
    this.model.root._loadChildren = true;
    this.postMixInProperties();
    this._load();
  },
  _initState: function(){
    // summary:
    //    Load in which nodes should be opened automatically
    this._openedNodes = {};
    if(this.persist && this.cookieName){
      var oreo = sessionStorage.getItem(this.cookieName);
      if(oreo){
        dojo.forEach(oreo.split(','), function(item){
          this._openedNodes[item] = true;
        }, this);
      }
    }
  },
  _state: function(node, expanded){
    // summary:
    //    Query or set expanded state for an node
    if(!this.persist){
      return false;
    }
    var path = dojo.map(node.getTreePath(), function(item){
        return this.model.getIdentity(item);
      }, this).join("/");
    if(arguments.length === 1){
      return this._openedNodes[path];
    }else{
      if(expanded){
        this._openedNodes[path] = true;
      }else{
        delete this._openedNodes[path];
      }
      var ary = [];
      for(var id in this._openedNodes){
        ary.push(id);
      }
      sessionStorage.setItem(this.cookieName, ary.join(","));
    }
  }
});


_ColumnDnDSource = dojo.declare("FIRMOS.ColumnDnDSource",dgrid.ColumnReorder.ColumnDndSource, {
  onMouseDown: function(e) {
    e.stopPropagation = function() {};
    this.inherited(arguments);
  }
});

//ColumnReorder
dojo.declare("FIRMOS.ColumnReorder",dgrid.ColumnReorder, {
  columnDndConstructor: _ColumnDnDSource
});


_GridDnDSource = dojo.declare("FIRMOS.GridDnDSource",dgrid.DnD.GridSource, {
  allowNested: true,
  checkAcceptance: function(source, nodes) {
    for(var i = 0; i < nodes.length; ++i){
      var type = source.getItem(nodes[i].id).type;
      var flag = false;
      for (var j = 0; j < type.length; ++j){
        if (type[j] in this.accept) {
          flag = true;
          break;
        }
      }
      if (!flag) {
        return false;
      }
    }
    return true;
  },
  onMouseDown: function(e) {
    e.stopPropagation = function() {};
    this.inherited(arguments);
  },
  copyState: function(keyPressed, self) {
    return false;
  },
  getSelectedNodes: function() {
    if (this.grid.dndDisabled) return [];
    var error_objs = [];
    if (!this.current) {  //return no nodes if drag does not start over a node
      return [];
    }
    var t = new dojo.NodeList();
    for (var id in this.grid.selection) {
      var obj = this.grid.row(id).data;
      if ((!this.grid.dragClasses_ || (obj.dndclass in this.grid.dragClasses_)) && !obj._disabledrag_) {
        t.push(this._selectedNodes[id]);
      } else {
        error_objs.push(obj);
      }
    }
    if (error_objs.length>0) {
      var str='';
      for (var i=0; i<error_objs.length; i++) {
        str+=', '+this.grid.store.getLabel(error_objs[i]);
      }
      str=str.substr(2);
      console.log('Object(s) not dragable ' + str);
      return [];
    } else {
      return t;  // NodeList
    }
  },
  onDrop: function(sourceSource, nodes, copy){
    var targetSource = this,
      targetRow = this._targetAnchor = this.targetAnchor, // save for Internal
      grid = this.grid,
      store = grid.store;
     
    //Does NOT work with tree grid
    /*if(!this.before && targetRow){
      // target before next node if dropped within bottom half of this node
      // (unless there's no node to target at all)
      targetRow = targetRow.nextSibling;
    }*/
    targetRow = targetRow && grid.row(targetRow);
      
    dojo.Deferred.when(targetRow && store.get(store.getIdentity(targetRow.data)), function(target){
      // Note: if dropping after the last row, or into an empty grid,
      // target will be undefined.  Thus, it is important for store to place
      // item last in order if options.before is undefined.
        
      // Delegate to onDropInternal or onDropExternal for rest of logic.
      // These are passed the target item as an additional argument.
      if(targetSource != sourceSource){
        targetSource.onDropExternal(sourceSource, nodes, copy, target);
      }else{
        targetSource.onDropInternal(nodes, copy, target);
      }
    });
  },
  onDropInternal: function(nodes, copy, targetItem){
    var store = this.grid.store,
      targetSource = this,
      grid = this.grid,
      anchor = targetSource._targetAnchor,
      targetRow;
      
    if(anchor){ // (falsy if drop occurred in empty space after rows)
      targetRow = this.before ? anchor.previousSibling : anchor.nextSibling;
    }
      
    // Don't bother continuing if the drop is really not moving anything.
    // (Don't need to worry about edge first/last cases since dropping
    // directly on self doesn't fire onDrop, but we do have to worry about
    // dropping last node into empty space beyond rendered rows.)
/*    if(!copy && (targetRow === nodes[0] ||
        (!targetItem && grid.down(grid.row(nodes[0])).element == nodes[0]))){
      return;
    } */
    var items = [];  
    nodes.forEach(function(node){
      items.push(targetSource.getObject(node));
    });
   store[copy && store.copy ? "copy" : "put"](items, {before: targetItem, mousePos: this.mousePos_});
  },
  onDropExternal: function(sourceSource, nodes, copy, targetItem){  // don't remove item after drop
    // Note: this default implementation expects that two grids do not
    // share the same store.  There may be more ideal implementations in the
    // case of two grids using the same store (perhaps differentiated by
    // query), dragging to each other.
    var store = this.grid.store,
      sourceGrid = sourceSource.grid;
      
    // TODO: bail out if sourceSource.getObject isn't defined?
    var items = [];  
    nodes.forEach(function(node, i){
      items.push(sourceSource.getObject(node));
    });
    store[copy && store.copy ? "copy" : "put"](items, {source: sourceGrid.store, before: targetItem, mousePos: this.mousePos_});
  },
  getObject: function(node){
    return this.grid.row(node).data;
  },
  onMouseMove: function(e){
    // summary:
    //    event processor for onmousemove
    // e: Event
    //    mouse event
    if (this.isDragging && this.targetState == "Disabled") { return; }
    dojo.dnd.Source.superclass.onMouseMove.call(this, e);
    var m = dojo.dnd.Manager.manager();
    if(!this.isDragging){
      if(this.mouseDown && this.isSource &&
          (Math.abs(e.pageX - this._lastX) > this.delay || Math.abs(e.pageY - this._lastY) > this.delay)){
        var nodes = this.getSelectedNodes();
        if(nodes.length){
          m.startDrag(this, nodes, this.copyState(dojo.dnd.getCopyKeyState(e), true));
        }
      }
    }
    if(this.isDragging){
      this.mousePos_ = {x: e.pageX, y: e.pageY};
      // calculate before/after
      var before = false;
      if(this.current){
        if(!this.targetBox || this.targetAnchor != this.current){
          this.targetBox = dojo.domGeo.position(this.current, true);
        }
        if(this.horizontal){
          // In LTR mode, the left part of the object means "before", but in RTL mode it means "after".
          before = (e.pageX - this.targetBox.x < this.targetBox.w / 2) == dojo.domGeo.isBodyLtr(this.current.ownerDocument);
        }else{
          before = (e.pageY - this.targetBox.y) < (this.targetBox.h / 2);
        }
      }
      if(this.current != this.targetAnchor || before != this.before){
        this._markTargetAnchor(before);
        if (!(this.grid.dropClassesMultiple_ || this.grid.dropClassesSimple_)) { //no drop classes defined => allow drop everywhere
          m.canDrop(true);
        } else {
          if (this.current) {
            var obj = this.grid.row(this.current).data;
            if (((this.grid.dropClassesSingle_ && (obj.dndclass in this.grid.dropClassesSingle_) && (this.grid.selection_.length==1)) || 
                 (this.grid.dropClassesMultiple_ && (obj.dndclass in this.grid.dropClassesMultiple_))) && 
                !obj._disabledrop_) {
              var target_in_selection = false;
              for (var i=0; i<m.nodes.length; i++) {
                if (m.source.grid.store.getIdentity(m.source.grid.row(m.nodes[i]))==this.grid.store.getIdentity(obj)) {
                  target_in_selection = true;
                  break;
                }
              }
              if (target_in_selection) {
                m.canDrop(false); //current in selection => no drop
              } else {
                m.canDrop(true); //current in drop classes and no explicit disable => can drop
              }
            } else {
              m.canDrop(false); //current not in drop classes or explicit disable => no drop
            }
          } else {
            m.canDrop(false); //drop classes and no current => no drop
          }
        }
      }
    }
  }
});

//GridDnD
dojo.declare("FIRMOS.GridDnD", dgrid.DnD, {
  dndAcceptType: ["dgrid-row"],
  dndConstructor: _GridDnDSource,
  postMixInProperties: function() {
    this.inherited(arguments);
    this.dndParams = dojo.mixin(this.dndParams, { accept: this.dndAcceptType });
  }
});

//Selection
dojo.declare("FIRMOS.Selection",dgrid.Selection, {
  clearSelection: function(exceptId, dontResetLastSelected){//override dgrid function
    // summary:
    //    Deselects any currently-selected items.
    // exceptId: Mixed?
    //    If specified, the given id will not be deselected.
    
    this.allSelected = false;
    for(var id in this.selection){
      if(exceptId !== id){
        this._select(id, null, false);
      }
    }
    if(!dontResetLastSelected){
      this._lastSelected = null;
    }
    //this._fireSelectionEvents(); //don't fire events
  }
});

//GridBase
dojo.declare("FIRMOS.GridBase", null, {
  constructor: function(args) {
    if (args.dragClasses) {
      this.dragClasses_ = {};
      for (var i=0; i<args.dragClasses.length; i++) {
        this.dragClasses_[args.dragClasses[i]] = true;
      }
      delete args.dragClasses;
    }
    if (args.dropClassesMultiple) {
      this.dropClassesMultiple_ = {};
      for (var i=0; i<args.dropClassesMultiple.length; i++) {
        this.dropClassesMultiple_[args.dropClassesMultiple[i]] = true;
      }
      delete args.dropClassesMultiple;
    }
    if (args.dropClassesSingle) {
      this.dropClassesSingle_ = {};
      for (var i=0; i<args.dropClassesSingle.length; i++) {
        this.dropClassesSingle_[args.dropClassesSingle[i]] = true;
      }
      delete args.dropClassesSingle;
    }
    this.depStores_ = new Array();
    this.buttons_ = new Array();
    this.storeRefreshHandler_ = new Object();
    this.selection_ = new Array();
    this._events = new Array();
    G_UI_COM.registerStoreView(args.store.id,this);
    if (args.selDepClassname) {
      this.id = args.id;
      G_UI_COM.registerSelDepFunc(args.selDepClassname, args.selDepFunctionname, this);
    }
  },
  destroy: function() {
    G_UI_COM.unregisterStoreView(this.store.id,this);
    this.selection = {};
    this.notifyServer();
    if (this.selDepClassname) {
      G_UI_COM.unregisterSelDepFunc(this.selDepClassname, this.selDepFunctionname, this);
    }
    for (var i=0; i<this.depStores_.length; i++) {
      G_UI_COM.deleteStoreDependency(this.depStores_[i].storeId,this.depStores_[i].refId);
    }
    while (this._events.length>0) {
      this._events.pop().remove();
    }
    for (var i in this._rowIdToObject) {
      this._cleanupRow(this._rowIdToObject[i]);
    }
    this.inherited(arguments);
  },
  getObjectDndType: function(obj) {
    return [this.id];
  },
  postCreate: function() {
    this.inherited(arguments);
    this._events.push(this.on(".dgrid-row:contextmenu",this.onContextMenu.bind(this)));
    this._events.push(this.on("dgrid-select",this.onSelect.bind(this)));
    this._events.push(this.on("dgrid-deselect",this.onDeselect.bind(this)));
    this._events.push(dojo.aspect.after(this,"expand",this._onExpand.bind(this),true));
  },
  getSelectedIds: function() {
    var selectedIds = new Array();
    for (var x in this.selection) {
      var row = this.row(x);
      selectedIds.push(this.store.getIdentity(row.data));
    }
    return selectedIds;
  },
  _onExpand: function(target) {
    var row = target.element ? target : this.row(target);
    var expand = this._expanded[row.id];

    if (expand) {
      var iconNodes = dojo.query(".firmosIconNode", target.element);
    } else {
      var iconNodes = dojo.query(".firmosIconNodeOpen", target.element);
    }
    for (var i=0; i<iconNodes.length; i++) {
      var parent = iconNodes[i].parentNode;
      if (expand) {
        if ((parent.nextSibling) && dojo.hasClass(parent.nextSibling,'firmosIconNodeDiv')) {
          dojo.style(parent,'display','none');
          dojo.style(parent.nextSibling,'display','');
        }
      } else {
        if ((parent.previousSibling) && dojo.hasClass(parent.previousSibling,'firmosIconNodeDiv')) {
          dojo.style(parent,'display','none');
          dojo.style(parent.previousSibling,'display','');
        }
      }
    }
  },
  _renderIconCell: function(object, value, node, options,iconId, openIconId) {
    var div = document.createElement('div');
    var innerHTML = "<div class='firmosIconNodeDiv'><img src='"+object[iconId]+"' class='firmosIconNode'></div>";
    if (openIconId && (openIconId!='')) {
      innerHTML = innerHTML + "<div class='firmosIconNodeDiv' style='display:none;'><img src='"+object[openIconId]+"' class='firmosIconNodeOpen'></div>"
    }
    innerHTML = innerHTML + "<span class='firmosIconNodeContentSpan'>" + value + "</span>";
    div.innerHTML = innerHTML;
    return div;
  },
  _renderDate: function(object, value, node, options) {
    var div = document.createElement('div'); 
    if (value) {
      div.innerHTML = dojo.date.locale.format(new Date(value), {formatLength: "short"});
    }
    return div;
  },
  _renderIcons: function(object, value, node, options) {
    var div = document.createElement('div'); 
    if (!value || (value=='')) {
     return '';
    }
    if (value instanceof Array) {
      var vals = value;
    } else {
      var vals=value.split(',');
    }
    var ret=''; 
    for (var i=0;i<vals.length;i++) {
      ret = ret + '<img src="' + vals[i] + '">';
    } 
    div.innerHTML = ret;
    return div;
  },
  _selectionChanged: function() {
    var selection_change = false;
    var selection = this.getSelectedIds();
    if (selection.length!=this.selection_.length) {
      selection_change = true;
    } else {
      for (var i=0; i<selection.length; i++) {
        if (selection[i]!=this.selection_[i]) {
          selection_change = true;
        }
      }
    }
    if (selection_change) {
      this.selection_ = selection;
    }
    return selection_change;
  },
  onSelect: function(event) {
    if (this._selectionChanged()) {
      this.onSelectionChanged(event,this.selection_);
    }
  },
  onDeselect: function(event) {
    if (this._selectionChanged()) {
      this.onSelectionChanged(event,this.selection_);
    }
  },
  onSelectionChanged: function(event,selection) {
    this.refreshDepStores(selection);
    this.refreshButtons(selection);
    this.notifyServer();
  },
  renderArray: function(results, beforeNode, options){ //override dgrid function
    // summary:
    //    This renders an array or collection of objects as rows in the grid, before the
    //    given node. This will listen for changes in the collection if an observe method
    //    is available (as it should be if it comes from an Observable data store).
    options = options || {};
    var self = this,
      start = options.start || 0,
      observers = this.observers,
      rows, container, observerIndex;
    
    if(!beforeNode){
      this._lastCollection = results;
    }
    if(results.observe){
      // observe the results for changes
      self._numObservers++;
      var observer = results.observe(function(object, from, to){
        var row, firstRow, nextNode, parentNode;
        
        function advanceNext() {
          nextNode = (nextNode.connected || nextNode).nextSibling;
        }

        if (from >-1 && to >-1) { //data change only
          var i = options.start + to;
          var id = self.id + "-row-" + (options.parentId ? options.parentId + "-" : "") + self.store.getIdentity(object);
          var row = dojo.byId(id);
          //var previousRow = row && row.previousSibling;
          //if(previousRow){
          // in this case, we are pulling the row from another location in the grid, and we need to readjust the rowIndices from the point it was removed
            //this.adjustRowIndices(previousRow);
          //}
          row.rowIndex = i;
          var new_row = self.renderRow(object,options);
          while (row.childNodes.length>0) {
            dojo.destroy(row.childNodes[0]);
          }
          while (new_row.childNodes.length>0) {
            dojo.place(new_row.childNodes[0],row);
          }
          dojo.destroy(new_row);
          self._rowIdToObject[id] = object; //set new data
          return; //nothing more to do!?!
        }
        
        // a change in the data took place
        if(from > -1 && rows[from]){
          var i = options.start + to;
          var id = self.id + "-row-" + (options.parentId ? options.parentId + "-" : "") + self.store.getIdentity(object);
          var row = dojo.byId(id);
          if (row) {
            self.removeRow(row);
          }

/*          // remove from old slot
          row = rows.splice(from, 1)[0];
          // check to make sure the node is still there before we try to remove it
          // (in case it was moved to a different place in the DOM)
          if(row.parentNode == container){
            firstRow = row.nextSibling;
            if(firstRow){ // it's possible for this to have been already removed if it is in overlapping query results
              if(from != to){ // if from and to are identical, it is an in-place update and we don't want to alter the rowIndex at all
                firstRow.rowIndex--; // adjust the rowIndex so adjustRowIndices has the right starting point
              }
            }
            self.removeRow(row);
          }*/
          // Update count to reflect that we lost one row
          options.count--;
          // The removal of rows could cause us to need to page in more items
          if(self._processScroll){
            self._processScroll();
          }
        }
        if(to > -1){
          // Add to new slot (either before an existing row, or at the end)
          // First determine the DOM node that this should be placed before.
          if(rows.length){
            if(to < 2){ // if it is one of the first rows, we can safely get the next item
              nextNode = rows[to];
              // Re-retrieve the element in case we are referring to an orphan
              nextNode = nextNode && correctElement(nextNode);
            }else{
              // If we are near the end of the page, we may not be able to retrieve the 
              // result from our own array, so go from the previous row and advance one
              nextNode = rows[to - 1];
              if(nextNode){
                nextNode = correctElement(nextNode);
                // Make sure to skip connected nodes, so we don't accidentally
                // insert a row in between a parent and its children.
                advanceNext();
              }
            }
          }else{
            // There are no rows.  Allow for subclasses to insert new rows somewhere other than
            // at the end of the parent node.
            nextNode = self._getFirstRowSibling && self._getFirstRowSibling(container);
          }
          // Make sure we don't trip over a stale reference to a
          // node that was removed, or try to place a node before
          // itself (due to overlapped queries)
          if(row && nextNode && row.id === nextNode.id){
            advanceNext();
          }
          if(nextNode && !nextNode.parentNode){
            nextNode = dojo.byId(nextNode.id);
          }
          parentNode = (beforeNode && beforeNode.parentNode) ||
            (nextNode && nextNode.parentNode) || self.contentNode;
          //row = self.newRow(object, parentNode, nextNode, options.start + to, options); //FIXXME
          row = self.newRow(object, parentNode, null, options.start + to, options); //HACK
          
          if(row){
            row.observerIndex = observerIndex;
            rows.splice(to, 0, row);
            if(!firstRow || to < from){
              // the inserted row is first, so we update firstRow to point to it
              var previous = row.previousSibling;
              // if we are not in sync with the previous row, roll the firstRow back one so adjustRowIndices can sync everything back up.
              firstRow = !previous || previous.rowIndex + 1 == row.rowIndex || row.rowIndex == 0 ?
                row : previous;
            }
          }
          options.count++;
        }
        
        if(from === 0){
          overlapRows(1, 1);
        }else if(from === results.length - (to === -1 ? 0 : 1)){
          // It was (re)moved from the end
          // (which was the previous length if it was a removal)
          overlapRows(0, 0);
        }
        
        from != to && firstRow && self.adjustRowIndices(firstRow);
        self._onNotification(rows, object, from, to);
      }, true);
      observerIndex = observers.push(observer) - 1;
    }
    var rowsFragment = document.createDocumentFragment(),
      lastRow;

    function overlapRows(){
      // This is responsible for setting row overlaps in result sets to
      // ensure that observable can always properly determine which page
      // an object belongs to.
      // This function uses kind of an esoteric argument, optimized for
      // performance and size, since it is called quite frequently.
      // `sides` is an array of overlapping operations, with a falsy item indicating
      // to add an overlap to the top, and a truthy item means to add an overlap
      // to the bottom (so [0, 1] adds one overlap to the top and the bottom)
      
      var sides = arguments;
      // Only perform row overlap in the case of observable results
      if(observerIndex > -1){
        // Iterate through the sides operations
        for(var i = 0; i < sides.length; i++){
          var top = sides[i];
          var lastRow = rows[top ? 0 : rows.length-1];
          // check to make sure we have a row, we won't if we don't have any rows
          if(lastRow){
            // Make sure we have the correct row element
            // (not one that was previously removed)
            lastRow = correctElement(lastRow);
            var row = self.row(lastRow);
            row = row && self[top ? "up" : "down"](row);
            if(row && row.element != lastRow){
              var method = top ? "unshift" : "push";
              // Take the row and data from the adjacent page and unshift to the
              // top or push to the bottom of our array of rows and results,
              // and adjust the count
              results[method](row.data);
              rows[method](row.element);
              options.count++;
            }
          }
        }
      }
    }
    function correctElement(row){
      // If a node has been orphaned, try to retrieve the correct in-document element
      // (use isDescendant since offsetParent is faulty in IE<9)
      if(!dojo.isDescendant(row, self.domNode) && dojo.byId(row.id)){
        return self.row(row.id.slice(self.id.length + 5)).element;
      }
      // Fall back to the originally-specified element
      return row;
    }
    
    function mapEach(object){
      lastRow = self.insertRow(object, rowsFragment, null, start++, options);
      lastRow.observerIndex = observerIndex;
      return lastRow;
    }
/*    function whenError(error){ //remove - no longer used
      if(typeof observerIndex !== "undefined"){
        observers[observerIndex].cancel();
        observers[observerIndex] = 0;
        self._numObservers--;
      }
      if(error){
        throw error;
      }
    }*/
    var originalRows;
    function whenDone(resolvedRows){
      // Save the original rows, before the overlapping is performed
      originalRows = resolvedRows.slice(0);
      container = beforeNode ? beforeNode.parentNode : self.contentNode;
      if(container && container.parentNode &&
          (container !== self.contentNode || resolvedRows.length)){
        container.insertBefore(rowsFragment, beforeNode || null);
        lastRow = resolvedRows[resolvedRows.length - 1];
        lastRow && self.adjustRowIndices(lastRow);
/*      }else if(observers[observerIndex] && self.cleanEmptyObservers){ // don't remove empty queries
        // Remove the observer and don't bother inserting;
        // rows are already out of view or there were none to track
        whenError(); */
      }
      rows = resolvedRows;
      if(observer){
        observer.rows = rows;
      }
    }
    
    // Now render the results
    if(results.map){
      rows = results.map(mapEach, console.error);
      if(rows.then){
        return results.then(function(resultsArray){
          results = resultsArray;
          return rows.then(function(resolvedRows){
            whenDone(resolvedRows);
            // Overlap rows in the results array when using observable
            // so that we can determine page boundary changes
            // (but return the original set)
            overlapRows(1, 1, 0, 0);
            return originalRows;
          });
        });
      }
    }else{
      rows = [];
      for(var i = 0, l = results.length; i < l; i++){
        rows[i] = mapEach(results[i]);
      }
    }
    
    whenDone(rows);
    overlapRows(1, 1, 0, 0);
    // Return the original rows, not the overlapped set
    return originalRows;
  },
  
  removeRow: function(rowElement, justCleanup){
    function chooseIndex(index1, index2){
      return index1 != null ? index1 : index2;
    }

    if(rowElement){
      this._cleanupRow(rowElement);

      // Clean up observers that need to be cleaned up.
      var previousNode = rowElement.previousSibling,
        nextNode = rowElement.nextSibling,
        prevIndex = previousNode && chooseIndex(previousNode.observerIndex, previousNode.previousObserverIndex),
        nextIndex = nextNode && chooseIndex(nextNode.observerIndex, nextNode.nextObserverIndex),
        thisIndex = rowElement.observerIndex;

      // Clear the observerIndex on the node being removed so it will not be considered any longer.
      rowElement.observerIndex = undefined;
      if(justCleanup){
        // Save the indexes from the siblings for future calls to removeRow.
        rowElement.nextObserverIndex = nextIndex;
        rowElement.previousObserverIndex = prevIndex;
      }

      // Is this row's observer index different than those on either side?
      if(this.cleanEmptyObservers && thisIndex > -1 && thisIndex !== prevIndex && thisIndex !== nextIndex){
        // This is the last row that references the observer index.  Cancel the observer.
        var observers = this.observers;
        var observer = observers[thisIndex];
        //if(observer){
        if(observer && this._numObservers>1){//don't remove the last observer
          // justCleanup is set to true when the list is being cleaned out.  The rows are left in the DOM
          // and later they are removed altogether.  Skip the check for overlapping rows because
          // in the end, all of the rows will be removed and all of the observers need to be canceled.
          if(!justCleanup){
          // We need to verify that all the rows really have been removed. If there
          // are overlapping rows, it is possible another element exists
            var rows = observer.rows;
            for(var i = 0; i < rows.length; i++){
              if(rows[i] != rowElement && dom.isDescendant(rows[i], this.domNode)){
                // still rows in this list, abandon
                return this.inherited(arguments);
              }
            }
          }
          observer.cancel();
          this._numObservers--;
          observers[thisIndex] = 0; // remove it so we don't call cancel twice
        }
      }
    }
    // Finish the row removal.
    this.inherited(arguments);
  },

  _cleanupRow: function(element) {
    var row = this.row(element);
    var description = dijit.byId(this.id + '_' + row.id+'_dcp');
    if (description) {
      description.destroyRecursive();
    }
    var content_container = dijit.byId(this.id + '_' + row.id+'_cc');
    if (content_container) {
      content_container.destroyRecursive();
    }
  },
  renderRow: function(item, options) {
    this._cleanupRow(item);
    var org_div = this.inherited(arguments);

    if ((this.descrField!='') && item[this.descrField] && (item[this.descrField]!='')) {
      var row = this.row(item);
      if (typeof options.queryLevel == 'undefined') {
        var level = 0;
      } else {
        var level = options.queryLevel + 1;
      }

      var indent = level * (this.indentWidth || 9);

      if (this.isTree) {
        var style_class = 'dgrid-description-row-tree';
      } else {
        var style_class = 'dgrid-description-row';
      }
      var html = '<div style="margin-left: '+indent+'px; float: left;"><div>' + item[this.descrField];
      var description = new dijit.layout.ContentPane({id: this.id + '_' + row.id+'_dcp', class: style_class, content: html});
      dojo.place(description.domNode,org_div);
    }

    if (this.showDetailsSection) {
      var detailsFunc = {};
      detailsFunc.params = {};
      if (item._detailsfunc_ && item._funcclassname_) {
        detailsFunc.classname = item._funcclassname_;
        detailsFunc.functionname = item._detailsfunc_;
      } else {
        if (this.detailsClassname) {
          detailsFunc.classname = this.detailsClassname;
          detailsFunc.functionname = this.detailsFunctionname;
          dojo.mixin(detailsFunc.params, this.detailsParams);
          if (this.detailsUidPath) {
            detailsFunc.uidPath = this.detailsUidPath;
          }
        }
      }
      if (detailsFunc.classname) {
        if (item.uidpath) {
          if (item.uidpath instanceof Array) {
            detailsFunc.params.selected = item.uidpath;
          } else {
            detailsFunc.params.selected = [item.uidpath];
          }
        } else {
          detailsFunc.params.selected = [item.uid];
        }
        if (!detailsFunc.uidPath) {
          detailsFunc.uidPath = detailsFunc.params.selected;
        }
        item._detailsfunc_ = detailsFunc;
        
        var row = this.row(item);
        var content_container = dijit.byId(this.id + '_' + row.id+'_cc');
        if (!content_container) {
          content_container = new dijit.layout.ContentPane({id: this.id + '_' + row.id+'_cc'});
          var content_pane = new dijit.layout.ContentPane({id: this.id + '_' + row.id+'_cp'});
          content_container.addChild(content_pane);
          dojo.style(content_container.domNode,'display','none');
        }
        dojo.place(content_container.domNode,org_div);
      }
    }

    return org_div;
  },
  showDetails: function(row) {
    var ccId = this.id + '_' + row.id + '_cc';
    G_UI_COM.setGridDetailsId(ccId);
    var content_container = dijit.byId(ccId);
    G_SERVER_COM.callServerFunction(row.data._detailsfunc_.classname,row.data._detailsfunc_.functionname,row.data._detailsfunc_.uidPath,row.data._detailsfunc_.params,this.detailsCallback.bind(this),content_container.getChildren()[0].id);
  },
  detailsCallback: function(options, success, response, uiState) {
    G_SERVER_COM.handleServerFunctionResponse(options,success,response,uiState);
    var content_container = dijit.byId(uiState.gridDetailsId);
    dojo.style(content_container.domNode,'display','');
  },
  hideDetails: function(row) {
    var ccId = this.id + '_' + row.id + '_cc';
    var content_container = dijit.byId(ccId);
    dojo.style(content_container.domNode,'display','none');
  },
  onContextMenu: function(event) {
    var row = this.row(event);
    this.contextMenu._handleGridMenu(event,this,row.data);
  },
  _refreshDepStoreViews: function(depStore) {
    delete(this.storeRefreshHandler_[depStore.store.id]);
    for (var i=0; i<depStore.views.length; i++) {
      G_UI_COM.refreshView(depStore.views[i]);
    }
  },
  refreshDepStore: function(storeId,refId,selection) {
    G_UI_COM.setStoreDependency(storeId,refId,'G',selection);
    var store = G_UI_COM.getStoreById(storeId);
    if (store) {
      //delete handler
      if (this.storeRefreshHandler_[storeId]) {
        clearTimeout(this.storeRefreshHandler_[storeId]);
        delete(this.storeRefreshHandler_[storeId]);
      }
      this.storeRefreshHandler_[storeId] = setTimeout(this._refreshDepStoreViews.bind(this,store),0);
    }
  },
  refreshDepStores: function(selection) {
    for (var i=0; i<this.depStores_.length; i++) {
      this.refreshDepStore(this.depStores_[i].storeId,this.depStores_[i].refId,selection);
    }
  },
  refreshButtons: function(selection) {
    var selection_count = selection.length;
    for (var i=0; i<this.buttons_.length; i++) {
      switch (this.buttons_[i].bType) {
        case 'gbd_single': 
          if (selection_count==1) {
            this.buttons_[i].button.set('disabled',false);
          } else {
            this.buttons_[i].button.set('disabled',true);
          }
          break;
        case 'gbd_multi':
          if (selection_count==0) {
            this.buttons_[i].button.set('disabled',true);
          } else {
            this.buttons_[i].button.set('disabled',false);
          }
          break;
        //case 'gbd_always': do nothing
        //case 'gbd_manual': do nothing
      }
    }
  },
  notifyServer: function() {
    if (this.selDepClassname) {
      var notifyParams = dojo.clone(this.store.params_);
      dojo.mixin(notifyParams, this.selDepParams);
      var parent = dijit.byId(this.parentId).getParent();
      var contentId = null;
      if (parent && parent._contentId) {
        contentId = parent._contentId;
      }
      G_SERVER_COM.callServerFunction(this.selDepClassname,this.selDepFunctionname,this.selDepUidPath, notifyParams, null, contentId);
    }
  },
  registerDepStore: function(storeId, refId) {
    this.depStores_.push({storeId: storeId, refId: refId});
    this.refreshDepStore(storeId, refId, this.selection_); 
  },
  registerButton: function(button, bType) {
    this.buttons_.push({button: button, bType: bType});
    button.setGrid(this);
  },
  doSearch: function(query) {
    this.store.params_.fulltext = query
    this.refresh();
  }
});

//FormButton
dojo.declare("FIRMOS.FormButton", dijit.form.Button, {
  onClick: function(evt) {
    evt.preventDefault();
    dojo.stopEvent(evt);
    this._getWidget().disableAllButtons();
    switch (this.type) {
      case 'submit': 
        this.handleTypeSubmit();
        break;
      case 'button': 
        this.handleTypeButton();
        break;
    }
  },
  _getWidget: function(dialogOnly) {
    var widget=this.getParent();
    while (widget && !widget.isInstanceOf(dijit.form.Form) && !widget.isInstanceOf(FIRMOS.Dialog)) {
      widget=widget.getParent();
    }
    if (dialogOnly) {
      while (widget && !widget.isInstanceOf(FIRMOS.Dialog)) {
        widget=widget.getParent();
      }
    }
    return widget;
  },
  handleTypeButton: function() {
    if (this.closeDialog) {
      var dialog = this._getWidget(true);
      if (dialog && dialog.isInstanceOf(FIRMOS.Dialog)) {
        dialog.hide();
      }
    }
    if (this.actionClassname) {
      G_SERVER_COM.callServerFunction(this.actionClassname,this.actionFunctionname,this.actionUidPath,this.actionParams,this.sfCallback.bind(this));
    }
    if (this.downloadId) {
      dojo.io.iframe.setSrc(dojo.byId('FirmOSDownload'),this.downloadId,true);
      if (!this.closeDialog) {
        this._getWidget().restoreAllButtons();
      }
    }
  },
  handleTypeSubmit: function() {
    var form = this._getWidget();
    if (form.isInstanceOf(dijit.form.Form)) {
      var params = dojo.clone(this.actionParams);
      form.callServerFunction(this.actionClassname,this.actionFunctionname,this.actionUidPath,params,this.hiddenFields,this.isDialog);
    }
  },
  sfCallback: function(options, success, response, uiState) {
    if (this.domNode) {
      this._getWidget().restoreAllButtons();
    }
    G_SERVER_COM.handleServerFunctionResponse(options,success,response,uiState);
  }
});

//Tooltip
dojo.declare("FIRMOS.Tooltip", dijit.Tooltip, {
  displayedFor: function() {
    return this._connectNode;
  }
});

//GridButton
dojo.declare("FIRMOS.GridButton", dijit.form.Button, {
  destroy: function() {
    var hint = dijit.byId(this.id + '_tooltip');
    if (hint) {
      hint.destroyRecursive();
    }
    this.inherited(arguments);
  },
  setGrid: function(grid) {
    this.grid_ = grid;
  },
  onClick: function() {
    var params = {};
    var selectedIds = this.grid_.getSelectedIds();
    var uidPath;
    
    params.dependency = this.grid_.store.params_.dependency;
    dojo.mixin(params, this.actionParams);
    params.selected = selectedIds;
    
    if (this.actionUidPath) {
      uidPath = this.actionUidPath;
    } else {
      if (selectedIds.length>0) {
        for (var x in this.grid.selection) {
          var rowId = x;
          break;
        }
        var item_data = this.grid_.row(rowId);
        uidPath = [selectedIds[0]];
        if (item_data.uidPath) {
          uidPath = item_data.uidPath;
        } else {
          if (item_data.uid) {
            uidPath = [item_data.uid];
          }
        }
      }
    }
    
    G_SERVER_COM.callServerFunction(this.actionClassname,this.actionFunctionname,uidPath,params);
  }
});


//widget.Calendar
dojo.declare("FIRMOS.widget.Calendar", dojox.widget.Calendar, {
  _setValueAttr: function(/*Date*/ value) {
    if (!value) return;
    this.inherited(arguments);
  }
});

//DateTextBox
dojo.declare("FIRMOS.DateTextBox", dijit.form.DateTextBox, {
  popupClass: 'FIRMOS.widget.Calendar',
  _blankValue: '',
  constructor: function(params) {
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
  },
  _setDisplayedValueAttr: function(value, priorityChange){
    if (isNaN(value)) {
      this.inherited(arguments);
    } else {
      var date_val = Number(value);
      if (date_val==0) {
        this._setValueAttr('', priorityChange, '');
      } else {
        this._setValueAttr(new Date(Number(value)), priorityChange, new Date(Number(value)));
      }
    }
  },
  onChange: function() {
    this.inherited(arguments);
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      form.checkGroupRequiredFields(this);
      form.submitOnChange(this);
    }
  }
});

//Recurrence
dojo.declare("FIRMOS.Recurrence", dijit.form._FormValueWidget, {
  texts: G_TEXTS.recurrence,
  _selectedRadioCSS: 'dijitChecked dijitRadioChecked',
  _selectedStr: 'aria-checked="true"',  
  _rtypeStr: '',
  _rtypeDetailsStr: '',
  _startStr: '',
  _endStr:'',
  rtypes: ['once','minute','hour','day','week','month','quarter','year'],
  days: ['mo','tu','we','th','fr','sa','su'],
  minuteDetails: [{label: '1', value:'1'},{label: '5', value:'5'},{label: '10', value:'10'},{label: '15', value:'15'},{label: '30', value:'30'},{label: '45', value:'45'}],
  hourDetails: [{label: '1', value:'1'},{label: '2', value:'2'},{label: '3', value:'3'},{label: '4', value:'4'},{label: '6', value:'6'},{label: '12', value:'12'}],
  dayDetails: [{label: '1', value:'1'},{label: '2', value:'2'},{label: '3', value:'3'},{label: '4', value:'4'},{label: '5', value:'5'},{label: '6', value:'6'}],
  monthDetails: [{label: '1', value:'1'},{label: '2', value:'2'},{label: '3', value:'3'},{label: '4', value:'4'},{label: '6', value:'6'}],
  rtypesVis: [],
  baseClass: 'firmosRecurrenceInput',
  templateString: '',
  templateStart: '<div data-dojo-attach-point="wrapperDiv,focusNode" id="${id}" role="presentation">',
  templateEnd:   '</div>',
  templateDivider: '<div class="firmosRecurrenceDividerContainer"><div class="firmosRecurrenceDivider"></div></div>',
  templateStartDate: '<div id="${id}_sd"></div><div id="${id}_st"></div>',
  templateEndDate: '<div id="${id}_ed"></div><div id="${id}_et"></div>',
  templateCount: '<div id="${id}_count"></div>',
  templateCB:
    '<div data-dojo-attach-point="${value}Div" class="firmosRecurrenceInputItem" role="presentation">'+
      '<div class="firmosRecurrenceCBContainer">'+ 
        '<div class="dijit dijitReset dijitInline dojoxMultiSelectItemBox dijitRadio" role="presentation">'+
          '<input class="dijitCheckBoxInput" data-dojo-type="dijit.form.CheckBox" data-dojo-attach-event="onclick:_onRadioClick, onmouseover: _onRadioMOver, onmouseout: _onRadioMOut" data-onclick="${onclick}" data-cbid="${value}" type="radio" "/>'+
        '</div>'+
        '<div class="dijitInline dojoxMultiSelectItemLabel" data-dojo-attach-event="onclick:${onclick}" data-cbid="${value}">${caption}</div>'+
      '</div>'+
      '${details}'+
    '</div>',
  templateonceDetails:'',
  templateminuteDetails:'<div class="dijitInline" style="float:right;"><div class="dijitInline" style="margin: 0 5px;">${caption}:</div><div id="${id}_m_detail"></div></div>',
  templatehourDetails:'<div class="dijitInline" style="float:right;"><div class="dijitInline" style="margin: 0 5px;">${caption}:</div><div id="${id}_h_detail"></div></div>',
  templatedayDetails:'<div class="dijitInline" style="float:right;"><div class="dijitInline" style="margin: 0 5px;">${caption}:</div><div id="${id}_d_detail"></div></div>',
  templateweekCB:'<div data-dojo-attach-point="${value}DayDiv" class="dijit dijitReset dijitInline dijitCheckBox" role="presentation"><input class="dijitReset dijitCheckBoxInput" data-onclick="_setWeekDetails" data-day="${value}" type="checkbox" data-dojo-attach-event="onclick:_onBoxClick, onmouseover: _onBoxMOver, onmouseout: _onBoxMOut" style="-moz-user-select: none;"></div>',
  templateweekDetails:'<div class="dijitInline" style="float:right;">${week_days}</div>',
  templatemonthDetails:'<div class="dijitInline" style="float:right;"><div class="dijitInline" style="margin: 0 5px;">${caption}:</div><div id="${id}_mo_detail"></div></div>',
  templatequarterDetails:'',
  templateyearDetails:'',

  constructor: function(params) {
    var week_days = '';
    for (var i=0; i<this.days.length; i++) {
      week_days=week_days+this.templateweekCB.replace(/\$\{value\}/g,this.days[i])+this.texts[this.days[i]]+' ';
    }
    this.templateweekDetails = this.templateweekDetails.replace(/\$\{week_days\}/g,week_days);
    
    this.templateString = this.templateStart;
    this.templateString = this.templateString + this.templateCB.replace(/\$\{caption\}/g,this.texts.startDate)
                                                               .replace(/\$\{value\}/g,'sd')
                                                               .replace(/\$\{details\}/g,this.templateStartDate)
                                                               .replace(/\$\{onclick\}/g,'_onSTSelect');

    this.templateString = this.templateString + this.templateDivider;
    
    for (var i=0; i<this.rtypes.length; i++) {
      if (params['ri'+this.rtypes[i]]) {
        this.rtypesVis.push(this.rtypes[i]);
        this.templateString = this.templateString + this.templateCB.replace(/\$\{caption\}/g,this.texts[this.rtypes[i]])
                                                                   .replace(/\$\{value\}/g,this.rtypes[i])
                                                                   .replace(/\$\{details\}/g,this['template'+this.rtypes[i]+'Details'].replace(/\$\{caption\}/g,this.texts.interval))
                                                                   .replace(/\$\{onclick\}/g,'_onRTSelect');
      }
    }

    this.templateString = this.templateString + this.templateDivider;
    
    this.templateString = this.templateString + this.templateCB.replace(/\$\{caption\}/g,this.texts.noEndDate)
                                                               .replace(/\$\{value\}/g,'ned')
                                                               .replace(/\$\{details\}/g,'')
                                                               .replace(/\$\{onclick\}/g,'_onETSelect');

    this.templateString = this.templateString + this.templateCB.replace(/\$\{caption\}/g,this.texts.endDate)
                                                               .replace(/\$\{value\}/g,'ed')
                                                               .replace(/\$\{details\}/g,this.templateEndDate)
                                                               .replace(/\$\{onclick\}/g,'_onETSelect');

    this.templateString = this.templateString + this.templateCB.replace(/\$\{caption\}/g,this.texts.count)
                                                               .replace(/\$\{value\}/g,'count')
                                                               .replace(/\$\{details\}/g,this.templateCount)
                                                               .replace(/\$\{onclick\}/g,'_onETSelect');

    this.templateString = this.templateString + this.templateEnd;
    
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
  },
  startup: function() {
    this.inherited(arguments);
    this.startDate = new FIRMOS.DateTextBox({style: 'float: right;', onChange: this._onSDTChange.bind(this)},this.id + '_sd');
    this.startTime = new dijit.form.TimeTextBox({style: 'float: right;', onChange: this._onSDTChange.bind(this), constraints: {timePattern: 'HH:mm',  clickableIncrement: 'T00:15:00', visibleIncrement: 'T01:00:00',  visibleRange: 'T01:00:00'}}, this.id + '_st');
    
    this.endDate = new FIRMOS.DateTextBox({style: 'float: right;', onChange: this._onEDTChange.bind(this)},this.id + '_ed');
    this.endTime = new dijit.form.TimeTextBox({style: 'float: right;', onChange: this._onEDTChange.bind(this), constraints: {timePattern: 'HH:mm',  clickableIncrement: 'T00:15:00', visibleIncrement: 'T01:00:00',  visibleRange: 'T01:00:00'}}, this.id + '_et');
    
    this.countSelect = new dijit.form.NumberSpinner({style: 'float: right; width: 60px;', onChange: this._onCountChange.bind(this), constraints: {min: 1,  places: 0}}, this.id + '_count');

    if (this.riminute) {
      this.minuteCB = new dijit.form.Select({style: 'width: 60px;', onChange: this._setMinuteDetails.bind(this), options: this.minuteDetails },this.id + '_m_detail');
      this._setMinuteDetailsUI('');
    }
    if (this.rihour) {
      this.hourCB = new dijit.form.Select({style: 'width: 60px;', onChange: this._setHourDetails.bind(this), options: this.hourDetails },this.id + '_h_detail');
      this._setHourDetailsUI('');
    }
    if (this.riday) {
      this.dayCB = new dijit.form.Select({style: 'width: 60px;', onChange: this._setDayDetails.bind(this), options: this.dayDetails },this.id + '_d_detail');
      this._setDayDetailsUI('');
    }
    if (this.riweek) {
      this._setWeekDetailsUI('');
    }
    if (this.rimonth) {
      this.monthCB = new dijit.form.Select({style: 'width: 60px;', onChange: this._setMonthDetails.bind(this), options: this.monthDetails },this.id + '_mo_detail');
      this._setMonthDetailsUI('');
    }
    
    this._selectRB(this.sdDiv);
    this._setValueUI(this.value || '');
  },
  _setValueUI: function(value) {
    var tmp = [];
    if (value!='') {
      var tmp = value.split('#');
    }
    
    var sd_notset = true;
    var rr_notset = true;
    for (var i=0; i<tmp.length; i++) {
      if (tmp[i].indexOf('DTSTART')==0) {
        this._setValueUIStart(tmp[i]);
        sd_notset = false;
      } else {
        if (tmp[i].indexOf('RRULE')==0) {
          this._setValueUIRRule(tmp[i]);
          rr_notset = false;
        } else {
          console.error('Unknown part in recurrence rule definition: ' + tmp[i]);
        }
      }
    }
    if (sd_notset) {
      this._setValueUIStart('');
    }
    if (rr_notset) {
      this._setValueUIRRule('');
    } 
  },
  _getChooserTime: function(time) {
    switch (Math.round(time.getMinutes() / 15)) {
      case 0: 
        time.setMinutes(0);
        break;
      case 1: 
        time.setMinutes(15);
        break;
      case 2: 
        time.setMinutes(30);
        break;
      case 3: 
        time.setMinutes(45);
        break;
      case 4: 
        time.setMinutes(0);
        time.setHours(time.getHours()+1);        
        break;
    }
    return time;
  },
  _setValueUIStart: function(value) {
    if (value=='') {
      var default_start = this._getChooserTime(new Date());
      this.startDate.set('value',default_start);
      this.startTime.set('value',default_start);
    } else {
      var ret = this._stringToDateTime(value.substring(8));
      this.startDate.set('value',ret.date);
      this.startTime.set('value',ret.time);
    }
  },
  _setValueUIRRule: function(value) {
    if (value=='') {
      this._setRecurrenceTypeUI([]);
      this._setUntilUI('');
      this._setCountUI('');
    } else {
      var rr = value.substr(6).split(';');
      if ((rr.length>1) && (rr[rr.length-1].indexOf('UNTIL')==0)) {
        this._setCountUI('');
        this._setUntilUI(rr[rr.length-1]);
        rr.pop();
      } else {
        this._setUntilUI('');
        if ((rr.length>1) && (rr[rr.length-1].indexOf('COUNT')==0)) {
          this._setCountUI(rr[rr.length-1]);
          rr.pop();
        } else {
          this._setCountUI('');
        }
      }
      this._setRecurrenceTypeUI(rr);
    }
  },
  _setRecurrenceTypeUI: function(rr) {
    var rtype = '';
    if (rr.length>0) {
      var freq = rr[0].substr(5);
      switch (freq) {
        case 'MINUTELY':
          rtype = 'minute';
          if ((rr.length>1) && (rr[1].indexOf('INTERVAL')==0)) {
            this._setMinuteDetailsUI(rr[1]);
          } else {
            this._setMinuteDetailsUI('');
          }
          break;
        case 'HOURLY':
          rtype = 'hour';
          if ((rr.length>1) && (rr[1].indexOf('INTERVAL')==0)) {
            this._setHourDetailsUI(rr[1]);
          } else {
            this._setHourDetailsUI('');
          }
          break;
        case 'DAILY':
          rtype = 'day';
          if ((rr.length>1) && (rr[1].indexOf('INTERVAL')==0)) {
            this._setDayDetailsUI(rr[1]);
          } else {
            this._setDayDetailsUI('');
          }
          break;
        case 'WEEKLY':
          rtype = 'week';
          if ((rr.length>1) && (rr[1].indexOf('BYDAY')==0)) {
            this._setWeekDetailsUI(rr[1]);
          } else {
            this._setWeekDetailsUI('');
          }
          break;
        case 'MONTHLY':
          if ((rr.length>1) && (rr[1]=='INTERVAL=3')) {
            rtype = 'quarter';
          } else {
            rtype = 'month';
            if ((rr.length>1) && (rr[1].indexOf('INTERVAL')==0)) {
              this._setMonthDetailsUI(rr[1]);
            } else {
              this._setMonthDetailsUI('');
            }
          }
          break;
        case 'YEARLY':
          rtype = 'year';
          break;
      }
    }
    if ((rtype=='') || (!this[rtype+'Div'])) {
      for (var i=0; i<this.rtypes.length; i++) {
        if (this[this.rtypes[i]+'Div']) {
          rtype = this.rtypes[i];
          break;
        }
      }
    }
    for (var i=0; i<this.rtypesVis.length; i++) {
      this._unselectRB(this[this.rtypesVis[i]+'Div']);
    }
    this._selectRB(this[rtype+'Div']);
    this._setRecurrenceType(rtype);
  },
  _setUntilUI: function(value) {
    if (value=='') {
      this._selectRB(this.nedDiv);
      this._unselectRB(this.edDiv);
      this._unselectRB(this.countDiv);
      var def_date = new Date();
      def_date.setFullYear(def_date.getFullYear()+1);
      var default_end = this._getChooserTime(def_date);
      this.endDate.set('value', default_end);
      this.endTime.set('value', default_end);
      this.endDate.set('disabled',true);
      this.endTime.set('disabled',true);
      this.countSelect.set('disabled',true);
    } else {
      this._selectRB(this.edDiv);
      this._unselectRB(this.nedDiv);
      this._unselectRB(this.countDiv);
      var ret = this._stringToDateTime(value.substring(6));
      this.endDate.set('value',ret.date);
      this.endTime.set('value',ret.time);
      this.endDate.set('disabled',false);
      this.endTime.set('disabled',false);
      this.countSelect.set('disabled',true);
    }
  },
  _setCountUI: function(value) {
    if (value=='') {
      this._selectRB(this.nedDiv);
      this._unselectRB(this.edDiv);
      this._unselectRB(this.countDiv);
      this.countSelect.set('value',1);
      this.endDate.set('disabled',true);
      this.endTime.set('disabled',true);
      this.countSelect.set('disabled',true);
    } else {
      this._selectRB(this.countDiv);
      this._unselectRB(this.nedDiv);
      this.countSelect.set('value',Number(value.substring(6)));
      this.endDate.set('disabled',true);
      this.endTime.set('disabled',true);
      this.countSelect.set('disabled',false);
    }
  },
  _setForeverUI: function() {
  },
  _internalSetValue: function() {
    this.value = this._startStr;
    if (this._rtypeStr!='') {
      this.value = this.value + '#' + this._rtypeStr + this._rtypeDetailsStr + this._endStr;
    }
  },
  _setRecurrenceType: function(rtype) {
    this._disableDetails();
    this._rtypeDetailsStr = '';
    if (rtype == this.rtypes[0]) { //once
      this._rtypeStr = '';
      this._disableEndBlock(true);
    } else {
      this._disableEndBlock(false);
      switch (rtype) {
        case this.rtypes[1]: //minute 
          this._disableMinuteDetails(false);
          this._setMinuteDetails();
          this._rtypeStr='RRULE:FREQ=MINUTELY';
          break;
        case this.rtypes[2]: //hour 
          this._disableHourDetails(false);
          this._setHourDetails();
          this._rtypeStr='RRULE:FREQ=HOURLY';
          break;
        case this.rtypes[3]: //day 
          this._disableDayDetails(false);
          this._setDayDetails();
          this._rtypeStr='RRULE:FREQ=DAILY';
          break;
        case this.rtypes[4]: //week 
          this._disableWeekDetails(false);
          this._setWeekDetails();
          this._rtypeStr='RRULE:FREQ=WEEKLY';
          break;
        case this.rtypes[5]: //month 
          this._disableMonthDetails(false);
          this._setMonthDetails();
          this._rtypeStr='RRULE:FREQ=MONTHLY';
          break;
        case this.rtypes[6]: //quarter
          this._rtypeStr='RRULE:FREQ=MONTHLY;INTERVAL=3';
          break;
        case this.rtypes[7]: //year 
          this._rtypeStr='RRULE:FREQ=YEARLY';
          break;
      }
    }
    this._internalSetValue();
  },
  _setMinuteDetailsUI: function(value) {
    if (value=='') {
      this.minuteCB.set('value',this.minuteDetails[0].id);
    } else {
      var interval = value.substr(9);
      this.minuteCB.set('value',interval);
    }
  },
  _setHourDetailsUI: function(value) {
    if (value=='') {
      this.hourCB.set('value',this.hourDetails[0].id);
    } else {
      var interval = value.substr(9);
      this.hourCB.set('value',interval);
    }
  },
  _setDayDetailsUI: function(value) {
    if (value=='') {
      this.dayCB.set('value',this.dayDetails[0].id);
    } else {
      var interval = value.substr(9);
      this.dayCB.set('value',interval);
    }
  },
  _setWeekDetailsUI: function(value) {
    for (var i=0; i<this.days.length; i++) {
      this._unselectCB(this[this.days[i]+'DayDiv']);
    }
    if (value=='') {
      var dayVal = new Date().getDay();
      if (dayVal==0) {
        dayVal = 6;
      } else {
        dayVal--;
      }
      this._selectCB(this[this.days[dayVal]+'DayDiv']);
    } else {
      var days = value.substr(6).split(',');
      for (var i=0; i<days.length; i++) {
        this._selectCB(this[days[i].toLowerCase()+'DayDiv']);
      }
    }
  },
  _setMonthDetailsUI: function(value) {
    if (value=='') {
      this.monthCB.set('value',this.monthDetails[0].id);
    } else {
      var interval = value.substr(9);
      this.monthCB.set('value',interval);
    }
  },
  _setMinuteDetails: function() {
    var inter = this.minuteCB.get('value');
    if (inter!='1') {
      this._rtypeDetailsStr = ';INTERVAL='+inter;
    } else {
      this._rtypeDetailsStr = '';
    }
    this._internalSetValue();
  },
  _setHourDetails: function() {
    var inter = this.hourCB.get('value');
    if (inter!='1') {
      this._rtypeDetailsStr = ';INTERVAL='+inter;
    } else {
      this._rtypeDetailsStr = '';
    }
    this._internalSetValue();
  },
  _setDayDetails: function() {
    var inter = this.dayCB.get('value');
    if (inter!='1') {
      this._rtypeDetailsStr = ';INTERVAL='+inter;
    } else {
      this._rtypeDetailsStr = '';
    }
    this._internalSetValue();
  },
  _setWeekDetails: function() {
    var selected = [];
    for (var i=0; i<this.days.length; i++) {
      if (this._isSelectedCB(this[this.days[i]+'DayDiv'])) {
        selected.push(this.days[i].toUpperCase());
      }
    }
    this._rtypeDetailsStr = selected.join(',');
    if (this._rtypeDetailsStr.length>0) {
      this._rtypeDetailsStr = ';BYDAY=' + this._rtypeDetailsStr;
    }
    this._internalSetValue();
  },
  _setMonthDetails: function() {
    var inter = this.monthCB.get('value');
    if (inter!='1') {
      this._rtypeDetailsStr = ';INTERVAL='+inter;
    } else {
      this._rtypeDetailsStr = '';
    }
    this._internalSetValue();
  },
  _disableDetails: function() {
    this._disableMinuteDetails(true);
    this._disableHourDetails(true);
    this._disableDayDetails(true);
    this._disableWeekDetails(true);
    this._disableMonthDetails(true);
  },
  _disableMinuteDetails: function(disabled) {
    this.minuteCB.set('disabled',disabled);
  },
  _disableHourDetails: function(disabled) {
    this.hourCB.set('disabled',disabled);
  },
  _disableDayDetails: function(disabled) {
    this.dayCB.set('disabled',disabled);
  },
  _disableWeekDetails: function(disabled) {
    if (disabled) {
      for (var i=0; i<this.days.length; i++) {
        this._disableCB(this[this.days[i]+'DayDiv']);
      }
    } else {
      for (var i=0; i<this.days.length; i++) {
        this._enableCB(this[this.days[i]+'DayDiv']);
      }
    }
  },
  _disableMonthDetails: function(disabled) {
    this.monthCB.set('disabled',disabled);
  },
  _disableEndBlock: function(disabled) {
    if (disabled) {
      this._disableRB(this.edDiv);
      this._disableRB(this.nedDiv);
      this.endDate.set('disabled',true);
      this.endTime.set('disabled',true);
      this.countSelect.set('disabled',true);
    } else {
      this._enableRB(this.edDiv);
      this._enableRB(this.nedDiv);
      if (this._isSelectedRB(this.edDiv)) {
        this.endDate.set('disabled',false);
        this.endTime.set('disabled',false);
      }
      if (this._isSelectedRB(this.countDiv)) {
        this.countSelect.set('disabled',false);
      }
    }
  },
  _onCountChange: function() {
    this._endStr = ';COUNT=' + this.countSelect.get('value');
    this._internalSetValue();
  },
  _onEDTChange: function() {
    this._endStr = ';UNTIL=' + this._dateTimeToString(this.endDate.get('value'),this.endTime.get('value'));
    this._internalSetValue();
  },
  _onSDTChange: function() {
    this._startStr = 'DTSTART:' + this._dateTimeToString(this.startDate.get('value'),this.startTime.get('value'));
    this._internalSetValue();
  },
  _stringToDateTime: function(str) {
    var ret = {};

    var tmp = str.split('T');
    
    ret.date = new Date(Number(tmp[0].substr(0,4)), Number(tmp[0].substr(4,2))-1, Number(tmp[0].substr(6,2)));
    if (tmp.length>1) {
      ret.time = new Date(Number(tmp[0].substr(0,4)), Number(tmp[0].substr(4,2))-1, Number(tmp[0].substr(6,2)),
                          Number(tmp[1].substr(0,2)), Number(tmp[1].substr(2,2)), Number(tmp[1].substr(4,2)));
      //handel time part   Z == GMT
      if ((tmp[1].length==7) && (tmp[6]=='Z')) {
        ret.time.setMinutes(ret.time.getMinutes()+ret.time.getTimezoneOffset());
      }
    }
    return ret;
  },
  _dateTimeToString: function(date, time) {
    var str = '' + date.getFullYear();
    if (date.getMonth()<9) {
      str = str + '0';
    }
    str = str + (date.getMonth()+1);
    if (date.getDate()<10) {
      str = str + '0';
    }
    str = str + date.getDate();
    
    str = str + 'T';
    if (time.getHours()<10) {
      str = str + '0';
    }
    str = str + time.getHours();
    if (time.getMinutes()<10) {
      str = str + '0';
    }
    str = str + time.getMinutes();
    if (time.getSeconds()<10) {
      str = str + '0';
    }
    str = str + time.getSeconds();

    return str;
  },
  _onSTSelect: function(evt) {
  },
  _onETSelect: function(evt) {
    switch (evt.target.getAttribute('data-cbid')) {
      case 'ned':
        this._selectRB(this.nedDiv);
        this._unselectRB(this.edDiv);
        this._unselectRB(this.countDiv);
        this._endStr = '';
        this.endDate.set('disabled',true);
        this.endTime.set('disabled',true);
        this.countSelect.set('disabled',true);
        break;
      case 'ed':
        this._selectRB(this.edDiv);
        this._unselectRB(this.nedDiv);
        this._unselectRB(this.countDiv);
        this.endDate.set('disabled',false);
        this.endTime.set('disabled',false);
        this.countSelect.set('disabled',true);
        this._endStr = ';UNTIL=' + this._dateTimeToString(this.endDate.get('value'),this.endTime.get('value'));
        break;
      case 'count':
        this._selectRB(this.countDiv);
        this._unselectRB(this.nedDiv);
        this._unselectRB(this.edDiv);
        this.endDate.set('disabled',true);
        this.endTime.set('disabled',true);
        this.countSelect.set('disabled',false);
        this._endStr = ';COUNT=' + this.countSelect.get('value');
        break;
    }
    this._internalSetValue();
  },
  _onRTSelect: function(evt) {
    for (var i=0; i<this.rtypesVis.length; i++) {
      this._unselectRB(this[this.rtypesVis[i]+'Div']);
    }
    this._selectRB(this[evt.target.getAttribute('data-cbid')+'Div']);
    this._setRecurrenceType(evt.target.getAttribute('data-cbid'));
  },
  _disableRB: function(divElem) {
    dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitDisabled');
    dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitRadioDisabled');
    if (this._isSelectedRB(divElem)) {
      dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitCheckedDisabled');
      dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitRadioCheckedDisabled');
    }
  },
  _enableRB: function(divElem) {
    dojo.removeClass(divElem.childNodes[0].childNodes[0],'dijitDisabled');
    dojo.removeClass(divElem.childNodes[0].childNodes[0],'dijitRadioDisabled');
    dojo.removeClass(divElem.childNodes[0].childNodes[0],'dijitCheckedDisabled');
    dojo.removeClass(divElem.childNodes[0].childNodes[0],'dijitRadioCheckedDisabled');
  },
  _unselectRB: function(divElem) {
    dojo.removeClass(divElem.childNodes[0].childNodes[0],'dijitChecked');
    dojo.removeClass(divElem.childNodes[0].childNodes[0],'dijitRadioChecked');
  },
  _selectRB: function(divElem) {
    dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitChecked');
    dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitRadioChecked');
    if (dojo.hasClass(divElem.childNodes[0].childNodes[0],'dijitHover')) {
      dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitCheckedHover');
      dojo.addClass(divElem.childNodes[0].childNodes[0],'dijitRadioCheckedHover');
    }
  },
  _isSelectedRB: function(divElem) {
    return dojo.hasClass(divElem.childNodes[0].childNodes[0],'dijitChecked');
  },
  _disableCB: function(divElem) {
    dojo.addClass(divElem,'dijitDisabled');
    dojo.addClass(divElem,'dijitCheckBoxDisabled');
    if (this._isSelectedCB(divElem)) {
      dojo.addClass(divElem,'dijitCheckedDisabled');
      dojo.addClass(divElem,'dijitCheckBoxCheckedDisabled');
    }
  },
  _enableCB: function(divElem) {
    dojo.removeClass(divElem,'dijitDisabled');
    dojo.removeClass(divElem,'dijitCheckBoxDisabled');
    dojo.removeClass(divElem,'dijitCheckedDisabled');
    dojo.removeClass(divElem,'dijitCheckBoxCheckedDisabled');
  },
  _unselectCB: function(divElem) {
    dojo.removeClass(divElem,'dijitChecked');
    dojo.removeClass(divElem,'dijitCheckBoxChecked');
    dojo.removeClass(divElem,'dijitCheckedHover');
    dojo.removeClass(divElem,'dijitCheckBoxCheckedHover');
  },
  _selectCB: function(divElem) {
    dojo.addClass(divElem,'dijitChecked');
    dojo.addClass(divElem,'dijitCheckBoxChecked');
    if (dojo.hasClass(divElem,'dijitHover')) {
      dojo.addClass(divElem,'dijitCheckedHover');
      dojo.addClass(divElem,'dijitCheckBoxCheckedHover');
    }
  },
  _isSelectedCB: function(divElem) {
    return dojo.hasClass(divElem,'dijitChecked');
  },
  _onBoxClick: function(evt) {
    if (dojo.hasClass(evt.target.parentNode,'dijitDisabled')) return;
    if (evt.target.getAttribute('aria-checked')=='true') {
      evt.target.setAttribute('aria-checked',false);
      this._unselectCB(evt.target.parentNode);
    } else {
      evt.target.setAttribute('aria-checked',true);
      this._selectCB(evt.target.parentNode);
    }
    this[evt.target.getAttribute('data-onclick')](evt);
  },
  _onBoxMOver: function(evt) {
    if (dojo.hasClass(evt.target.parentNode,'dijitDisabled')) return;
    dojo.addClass(evt.target.parentNode,'dijitHover');
    dojo.addClass(evt.target.parentNode,'dijitCheckBoxHover');
    if (dojo.hasClass(evt.target.parentNode,'dijitChecked')) {
      dojo.addClass(evt.target.parentNode,'dijitCheckBoxCheckedHover');
      dojo.addClass(evt.target.parentNode,'dijitCheckedHover');
    }
  },
  _onBoxMOut: function(evt) {
    if (dojo.hasClass(evt.target.parentNode,'dijitDisabled')) return;
    dojo.removeClass(evt.target.parentNode,'dijitHover');
    dojo.removeClass(evt.target.parentNode,'dijitCheckBoxHover');
    dojo.removeClass(evt.target.parentNode,'dijitCheckBoxCheckedHover');
    dojo.removeClass(evt.target.parentNode,'dijitCheckedHover');
  },
  _onRadioClick: function(evt) {
    if (dojo.hasClass(evt.target.parentNode,'dijitDisabled')) return;
    this[evt.target.getAttribute('data-onclick')](evt);
  },
  _onRadioMOver: function(evt) {
    if (dojo.hasClass(evt.target.parentNode,'dijitDisabled')) return;
    dojo.addClass(evt.target.parentNode,'dijitHover');
    dojo.addClass(evt.target.parentNode,'dijitRadioHover');
    if (dojo.hasClass(evt.target.parentNode,'dijitChecked')) {
      dojo.addClass(evt.target.parentNode,'dijitRadioCheckedHover');
      dojo.addClass(evt.target.parentNode,'dijitRadioHover');
    }
  },
  _onRadioMOut: function(evt) {
    if (dojo.hasClass(evt.target.parentNode,'dijitDisabled')) return;
    dojo.removeClass(evt.target.parentNode,'dijitHover');
    dojo.removeClass(evt.target.parentNode,'dijitRadioHover');
    dojo.removeClass(evt.target.parentNode,'dijitRadioCheckedHover');
    dojo.removeClass(evt.target.parentNode,'dijitRadioHover');
  },
  onChange: function() {
    this.inherited(arguments);
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      form.checkGroupRequiredFields(this);
      form.submitOnChange(this);
    }
  }
});

//FileUpload
dojo.declare("FIRMOS.FileUpload", dojox.form.Uploader, {
  required: false,
  constructor: function(params) {
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
    if (params.disabled) {
      setTimeout(this.set.bind(this,'disabled',true),0);
      delete params.disabled;
    }
  },
  _isEmpty: function() {
    return (this.getValue()=='');
  },
  isValid: function(isFocused){
    return (!this.required || !this._isEmpty());
  },
  validate: function(isFocused){
    var message = "";
    var isValid = this.disabled || this.isValid(isFocused);
    dojo.setAttr(this.focusNode,"aria-invalid",isValid ? "false" : "true");
    message = this.getErrorMessage(isFocused);
    this.set("message", message);
    return isValid;
  },
  postMixInProperties: function(){
    this.inherited(arguments);
    this.messages = dojo.i18n.getLocalization("dijit.form", "validate", this.lang);
  },
  getErrorMessage: function(isFocused){
    return this.messages.missingMessage;
  },
  _createInput: function(){
    this.inherited(arguments);
    if (this.usefilter=='image') {
      dojo.setAttr(this.inputNode,"accept", "image/*");
    }
  },
  _onFocus: function() {
    this.focused = true;
    this.displayMessage(this.message);
    this.inherited(arguments);
  },
  _onBlur: function(){
    this.focused = false;
    this.displayMessage('');
    this.inherited(arguments);
  },
  displayMessage: function(message){
    if (message && this.focused) {
      dijit.Tooltip.show(message, this.titleNode);
    } else {
      dijit.Tooltip.hide(this.titleNode);
    }
  },
  _setRequiredAttr: function(value){
    this._set("required", value);
    dojo.setAttr(this.focusNode,"aria-required", value);
  },
  _setMessageAttr: function(/*String*/ message){
    this._set("message", message);
    this.displayMessage(message);
  },
  onChange: function() {
    this.inherited(arguments);
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      form.checkGroupRequiredFields(this);
      form.submitOnChange(this);
    }
  }
});

//FileUpload.Image
dojo.declare("FIRMOS.FileUpload.Image", dojox.form.uploader._Base, {
  uploaderId:"",
  uploader:null,
  _upCheckCnt:0,
  imgheight: 100,
  imgwidth: 100,
  imgabs: false,

  templateString: '<div class="firmosUploaderImage"></div>',
  constructor: function(params) {
    this._events = new Array();
  },
  destroy: function() {
    while (this._events.length>0) {
      this._events.pop().remove();
    }
  },
  postCreate: function() {
    this.inherited(arguments);
    this.setUploader();
    if (this.value) {
      this._createImageTag(this.value);
    } else {
      this.contentDiv = dojo.create('div',{class: "firmosUploaderImageContent", style: "height:"+this.imgheight+"px; width:"+this.imgwidth+"px"}, this.domNode);
    }
  },
  _createImageTag: function(src) {
    if (this.imgabs) {
      var style_str = "height:"+this.imgheight+"px; width:"+this.imgwidth+"px";
    } else {
      var style_str = "max-height:"+this.imgheight+"px; max-width:"+this.imgwidth+"px";
    }
    this.contentImg = dojo.create('img',{class: "firmosUploaderImageContent", style: style_str, src: src}, this.domNode);
  },
  setUploader: function() {
    if (!this.uploaderId && !this.uploader) {
      console.error("FIRMOS.FileUpload.Image: No FIRMOS.FileUpload set.");
      return;
    }
    
    if (this.uploaderId && !this.uploader) {
      this.uploader = dijit.byId(this.uploaderId);
      if (!this.uploader) {
        this._upCheckCnt++;
        if (this._upCheckCnt>5) {
          console.error("FIRMOS.FileUpload.Image: No FIRMOS.FileUpload found with id " + this.uploaderId);
        } else {
          setTimeout(this.setUploader.bind(this),250);
        }
        return;
      }
    }

    this._events.push(dojo.connect(this.uploader, "onChange", this.selectionChange.bind(this)));
    this._events.push(dojo.connect(this.uploader, "reset", this.selectionReset.bind(this)));
//    this._events.push(dojo.connect(this.uploader, "onBegin", function(){}));
//    this._events.push(dojo.connect(this.uploader, "onProgress", "_progress"));
//    this._events.push(dojo.connect(this.uploader, "onComplete", function(){}));
  },
  onloadCallback: function(evt) {
    if (!this.contentImg) {
      dojo.destroy(this.contentDiv);
      this._createImageTag(evt.target.result);
    } else {
      dojo.setAttr(this.contentImg,'src',evt.target.result);
    }
  },
  selectionChange: function() {
    var reader = new FileReader();
    reader.onload =  this.onloadCallback.bind(this);
    reader.readAsDataURL(this.uploader._files[0]);
  },
  selectionReset: function() {
    console.log('selectionReset');
  }
});

//Form
dojo.declare("FIRMOS.Form", dijit.form.Form, {
  constructor: function(params) {
    this.sendChanged = dojo.fromJson(params.sendchanged);
    this.displayOnly = dojo.fromJson(params.displayonly);
    delete(params.sendchanged);
    this.groupRequiredFields = {};
    if (params.dbos) {
      this.id = params.id;
      G_UI_COM.registerFormDBOs(this, params.dbos);
    }
    if (params.onChangeClassname) {
      this._lastChange = new Date();
      this._sendChangesParams = {};
      this.sendChangesDelay = Number(params.onChangeDelay) || 0;
    }
  },
  destroy: function() {
    if (this.dbos) {
      G_UI_COM.unregisterFormDBOs(this.id, this.dbos);
    }
    this.inherited(arguments);
  },
  onSubmit: function() {
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if ((children[i].isInstanceOf(FIRMOS.FormButton)) && (children[i].type=='submit')) {
        children[i].handleTypeSubmit();
        break;
      }
    }
    return false;
  },
  onShow: function(event) {
    this.inherited(arguments);
    if (this.sendChanged) {
      this.initialData = this.get('value');
    }
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if (!children[i].name) continue; //skip non form elements
      if (this.displayOnly) {
        if (!children[i].isInstanceOf(FIRMOS.FormButton)) {
          children[i].set('disabled',true);
        }
      }
      if (children[i].isInstanceOf(FIRMOS.BoolCheckBox)) {
        children[i].updateDepFields(children);
      }
      if (children[i].isInstanceOf(FIRMOS.FilteringSelect)) {
        children[i].init();
      }
      var pathArray = children[i].name.split('.');
      pathArray.pop();
      if (pathArray.length==0) {
        if (children[i].groupRequired) {
          //'root' element => set required
          children[i].set('required',true);
          var labelElem = dojo.byId(children[i].id+'_label');
          dojo.removeClass(labelElem,"firmosFormLabel");
          dojo.addClass(labelElem,"firmosFormLabelRequired");
        }
      } else {
        var path = pathArray.join('.');
        if (!this.groupRequiredFields[path]) {
          this.groupRequiredFields[path] = new Object();
          this.groupRequiredFields[path].grf = new Array();
          this.groupRequiredFields[path].required = false;
          this.groupRequiredFields[path].fields = new Array();
        }
        if (children[i].groupRequired) {
          this.groupRequiredFields[path].grf.push(children[i].id);
        }
        this.groupRequiredFields[path].fields.push(children[i].id);
      }
    }
    for (var i in this.groupRequiredFields) {
      if (this.groupRequiredFields[i].grf.length==0) {
        delete this.groupRequiredFields[i]; 
      } else {
        //check initial state
        for (var j=0; j<this.groupRequiredFields[i].fields.length; j++) {
          var elem = dijit.byId(this.groupRequiredFields[i].fields[j]);
          if (elem.isInstanceOf(FIRMOS.BoolCheckBox)) continue; //ignore boolean fields
          if (elem.get('disabled')) continue; //ignore disabled fields
          var value = elem.get('value');
          if (value && (value!='')) {
            this._setGroupRequired(i,true);
            break;
          }
        }
      }
    }
  },
  
  _setGroupRequired: function(path, required) {
    for (var i=0; i<this.groupRequiredFields[path].grf.length; i++) {
      var elem = dijit.byId(this.groupRequiredFields[path].grf[i]);
      elem.set('required',required);
      var labelElem = dojo.byId(this.groupRequiredFields[path].grf[i]+'_label');
      if (required) {
        dojo.removeClass(labelElem,"firmosFormLabel");
        dojo.addClass(labelElem,"firmosFormLabelRequired");
      } else {
        dojo.removeClass(labelElem,"firmosFormLabelRequired");
        dojo.addClass(labelElem,"firmosFormLabel");
      }
    }
    this.groupRequiredFields[path].required = required;
  },
  
  checkGroupRequiredFields: function(field) {
    if (field.isInstanceOf(FIRMOS.BoolCheckBox)) return; //ignore boolean fields
    var pathArray = field.name.split('.');
    pathArray.pop();
    if (pathArray.length>0) {
      var path=pathArray.join('.');
      if (this.groupRequiredFields[path]) {
        newValue = field.get('value');
        if (!newValue || (newValue=='')) {
          //check if all fields are empty
          for (var i=0; i<this.groupRequiredFields[path].fields.length; i++) {
            var elem = dijit.byId(this.groupRequiredFields[path].fields[i]);
            if (elem.isInstanceOf(FIRMOS.BoolCheckBox)) continue; //ignore boolean fields
            if (elem.get('disabled')) continue; //ignore disabled fields
            var elemValue = elem.get('value');
            if (elemValue && (elemValue!='')) return;
          }
          this._setGroupRequired(path,false);
        } else {
          if (this.groupRequiredFields[path].required) return; //already set required
          this._setGroupRequired(path,true);
        }
      }
    }
  },
  
  submitOnChange: function(field) {
    if (this.onChangeClassname && (!field || !field.get('disabled'))) {
      var now = new Date();
      if (field) {
        this._lastChange = now;
        this._sendChangesParams[field.name] = field.get('value');
      }
      var diff = now-this._lastChange;
      if (diff>this.sendChangesDelay) {
        var params = dojo.clone(this.onChangeParams);
        G_SERVER_COM.callServerFunction(this.onChangeClassname, this.onChangeFunctionname, this.onChangeUidPath, this._sendChangesParams);
        this._sendChangesParams = {};
      } else {
        if (this._sendTimeout) {
          clearTimeout(this._sendTimeout);
        }
        this._sendTimeout = setTimeout(this.submitOnChange.bind(this),this.sendChangesDelay-diff);
      }
    }
  },
 
  _clearObject: function(newObj, oldObj) {
    for (var i in newObj) {
      if (newObj[i] instanceof Array) {
        //object arrays and arrays of arrays not checked!
        if (newObj[i].length==oldObj[i].length) {
          var same = true;
          for (var j=0; j<newObj[i].length; j++) {
            if (newObj[i][j]!==oldObj[i][j]) {
              same = false;
              break;
            }
          }
          if (same) {
            delete newObj[i];
          }
        }
      } else {
        if ((newObj[i] instanceof Date) || (oldObj[i] instanceof Date)) {
          if ((newObj[i] instanceof Date) && (oldObj[i] instanceof Date) && 
              (newObj[i].getTime()==oldObj[i].getTime())) {
            delete newObj[i];
          }
        } else {
          if (typeof newObj[i]=='object') {
            this._clearObject(newObj[i],oldObj[i]);
            var noElemFound = true;
            for (var j in newObj[i]) {
              noElemFound = false;
              break;
            }
            if (noElemFound) {
              delete newObj[i];
            }
          } else {
            if (newObj[i]===oldObj[i]) {
              delete newObj[i];
            }
          }
        }
      }
    }
  },
  
  _convertObjectData: function(obj) {
    for (var i in obj) {
      if (obj[i] instanceof Array) {
        for (var j=0; j<obj[i].length; j++) {
          if (obj[i][j] instanceof Date) {
            obj[i][j] = obj[i][j].getTime();
          }
        }
      } else {
        if (obj[i] instanceof Date) {
          obj[i] = obj[i].getTime();
        } else {
          if (obj[i]!=null) {
            if (typeof obj[i]=='object') {
              this._convertObjectData(obj[i]);
            } else {
              if (obj[i]==='') {
                obj[i]=null;
              }
            }
          }
        }
      }
    }
  },
  
  _getValueAttr: function() {
    var res = this.inherited(arguments);
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if (children[i].name && children[i]._ignore && res[children[i].name]) {
        delete res[children[i].name];
      }
    }
    return res;
  },

  _handleFiles: function(classname, functionname, uidPath, params, hiddenParams, isDialog) {
    var children = this.getChildren();
    var files = [];
    for (var i=0; i<children.length; i++) {
      if (!children[i].name) continue; //skip non form elements
      if (children[i].isInstanceOf(FIRMOS.FileUpload) && children[i]._files) {
        for (var j=0; j<children[i]._files.length; j++) {
          files.push({field: children[i].name, file: children[i]._files[j]});
        }
      }
    }
    if (files.length>0) {
      var binDataKey = G_SERVER_COM.getBinaryDataKey();
      this._sendFiles(classname, functionname, uidPath, params, hiddenParams, isDialog, files, binDataKey);
    } else {
      this._sendData(classname, functionname, uidPath, params, hiddenParams, isDialog);
    }
  },
  _sendFilesCallback: function(classname, functionname, uidPath, params, hiddenParams, isDialog, files, binDataKey) {
    if (files.length==0) {
      this._sendData(classname, functionname, uidPath, params, hiddenParams, isDialog, binDataKey)
    } else {
      this._sendFiles(classname, functionname, uidPath, params, hiddenParams, isDialog, files, binDataKey);
    }
  },
  
  _sendFiles: function(classname, functionname, uidPath, params, hiddenParams, isDialog, files, binDataKey) {
     var filedata = files.pop();
     var file = filedata.file;
     var up_params = {};
     up_params.data = {};
     up_params.data.size = file.size;
     up_params.data.name = file.name;
     up_params.data.type = file.type;
     up_params.data.field = filedata.field; 
     up_params.data.fieldIdx = 0;
     up_params.data.fieldCount = 1;
     up_params.data.chunksize = file.size;
     up_params.data.chunkIdx = 0; 
     var callback = this._sendFilesCallback.bind(this, classname, functionname, uidPath, params, hiddenParams, isDialog, files, binDataKey);
     G_SERVER_COM.callServerFunction('FIRMOS', 'binaryBulkTransfer', null, up_params, callback, null, file, binDataKey);
  },
  
  _sendData: function(classname, functionname, uidPath, params, hiddenParams, isDialog, binDataKey) {
    params.data = this.get('value');
    this.submitData = dojo.clone(params.data);
    if (this.sendChanged) {
      this._clearObject(params.data,this.initialData);
    }
    this._convertObjectData(params.data);
    dojo.mixin(params.data, hiddenParams);
    if (isDialog) {
      G_UI_COM.isDialogAction();
    }
    G_SERVER_COM.callServerFunction(classname, functionname, uidPath, params, this.submitCallback.bind(this),null,null, binDataKey);
  },
  
  callServerFunction: function(classname, functionname, uidPath, params, hiddenParams, isDialog) {
    if (!this.validate()) { 
      this.restoreAllButtons();
      return false;
    }
    this._handleFiles(classname, functionname, uidPath, params, hiddenParams, isDialog);
  },
  
  submitCallback: function(options, success, response, uiState) {
    this.restoreAllButtons();
    G_SERVER_COM.handleServerFunctionResponse(options,success,response,uiState);
  },
  
  disableAllButtons: function() {
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if (children[i].isInstanceOf(FIRMOS.FormButton)) {
        children[i]._orgState = children[i].get('disabled');
        children[i].set('disabled',true);
      }
    }
  },
  
  restoreAllButtons: function() {
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if (children[i].isInstanceOf(FIRMOS.FormButton)) {
        children[i].set('disabled',children[i]._orgState);
        delete children[i]._orgState;
      }
    }
  },
  
  _updateValues: function(obj,path) {
    for (var x in obj) {
      if (x=='uid') continue;
      if (x instanceof Object) {
        if (x instanceof Array) {
          var input = this.getInputById(path+x);
          if (input) {
            input.set('value',obj[x]);
          }
        } else {
          this._updateValues(obj[x],path+x+'.');
        }
      } else {
        var input = this.getInputById(path+x);
        if (input) {
          if (input.isInstanceOf(FIRMOS.DateTextBox)) {
            var old_value = input.get('value');
            if (old_value==null || old_value.getTime()!=obj[x]) {
              input.set('displayedValue',obj[x]);
            }
          } else {
            if (input.get('value')!==obj[x]) {
              input.set('value',obj[x]);
            }
          }
        }
      }
    }
  },
  
  updateValues: function(obj) {
    this._updateValues(obj,'');
  },
  
  getInputById: function(id) {
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if (children[i].name == id) {
        return children[i];
      }
    }
    return null;
  }
});

//ToolbarButton
dojo.declare("FIRMOS.ToolbarButton", dijit.form.Button, {
  onClick: function() {
    if (this.downloadId) {
       dojo.io.iframe.setSrc(dojo.byId('FirmOSDownload'),this.downloadId,true);
    }
    if (this.actionClassname) {
      G_SERVER_COM.callServerFunction(this.actionClassname,this.actionFunctionname,this.actionUidPath,this.actionParams);
    }
  }
});

//Toolbar
dojo.declare("FIRMOS.Toolbar", dijit.Toolbar, {
  constructor: function(params) {
  },
  postCreate: function() {
    this.inherited(arguments);
    for (var i=0; i<this.menuDef.length; i++) {
      if (this.menuDef[i].menu) {
        //submenu
        var dd_params = {
          style: "display: none;"
        };
        if (this.menuDef[i].id) {
          dd_params.id = this.menuDef[i].id;
        }
        var menu = new dijit.DropDownMenu(dd_params);
        var disabled = G_UI_COM.addMenuEntries(menu,this.menuDef[i].menu,this.menuDef[i].disabled);
        menu.set('disabled',disabled);
        var params = {
          label: this.menuDef[i].caption,
          dropDown: menu,
          disabled: disabled
        };
        var button = new dijit.form.DropDownButton(params);
        menu._parentUIElement = button;
        this.addChild(button);
      } else {
        var entry = this.menuDef[i];

        var params = {};
        if (entry.action) {
          params.actionClassname = entry.action.class;
          params.actionFunctionname = entry.action.func;
          params.actionUidPath = entry.action.uidPath;
          params.actionParams = entry.action.params;
        }
        if (entry.downloadId) {
          params.downloadId = entry.downloadId;
        }
        if (entry.caption=='') {
          params.showLabel=false;
        } else {
          params.label=entry.caption;
        }
        if (entry.icon) {
          var rName = entry.icon.replace(/[\/\.]/g,'');
          G_UI_COM.createCSSRule(rName,"background-image: url('"+entry.icon+"');background-repeat: no-repeat; height: 18px;text-align: center;width: 18px;");
          params.iconClass=rName;
        }
        if (entry.disabled) {
          params.disabled = true;
        }
        if (entry.id) {
          params.id = entry.id;
        }
        
        var button=new FIRMOS.ToolbarButton(params);
        this.addChild(button);
      }
    }
  }
});

//Menu
dojo.declare("FIRMOS.Menu", dijit.Menu, {
  _clearEntries: function() {
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      this.removeChild(children[i]);
      children[i].destroyRecursive();
    }
  },
  
  setCoords: function(xcoord, ycoord) {
    if (!this._openMyselfArgs) {
      this._openMyselfArgs = {};
    }
    this._openMyselfArgs.coords = {x: xcoord, y: ycoord};
  },
  
  entriesLoaded: function(entries) {
    this._clearEntries();
    G_UI_COM.addMenuEntries(this,entries,false);
    this.startup();
    this._openMyself(this._openMyselfArgs,true);
  },

  _openMyself: function(args,forceOpen){
    if (forceOpen) {
      this.inherited(arguments,[args]);
      return;
    }
    switch (this.cType) {
/*      case "grid":
        this._openMyselfArgs = args;
        break;*/
      case "tree":
        this._openMyselfArgs = args;
        this._handleTreeMenu(args);
        break;
      default:
        if (this.getChildren().length>0) {
          this.inherited(arguments);
        }
        break;
    }
  },

  _handleTreeMenu: function(args) {
    var tn = dijit.getEnclosingWidget(args.target);
    var menuParams = {};
    var menuFunc = {};
    if (tn.isInstanceOf(dijit._TreeNode)) {
      var item = tn.item;
      var tree = tn.tree;
      dojo.mixin(menuParams, tree.model.store.params_);

      if (item.uidpath) {
        if (item.uidpath instanceof Array) {
          menuFunc.uidPath = item.uidpath;
        } else {
          menuFunc.uidPath = [item.uidpath];
        }
      } else {
        menuFunc.uidPath = [item.uid];
      }
      if (item._menufunc_ && item._funcclassname_) {
        menuFunc.classname = item._funcclassname_;
        menuFunc.functionname = item._menufunc_;
      } else {
        if (this.treeItemClassname) {
          menuFunc.classname = this.treeItemClassname;
          menuFunc.functionname = this.treeItemFunctionname;
          dojo.mixin(menuParams, this.treeItemParams);
          if (this.treeItemUIDPath) {
            menuFunc.uidPath = this.treeItemUIDPath;
          }
        }
      }
      if ((menuFunc.uidPath.length>0) || (tree.model.store.getIdentity(item)!=menuFunc.uidPath[0])) {
        menuParams.selected = [tree.model.store.getIdentity(item)];
      }
    } else {
      var tree = tn;
      dojo.mixin(menuParams, tree.model.store.params_);
      menuFunc.classname = this.treeClassname;
      menuFunc.functionname = this.treeFunctionname;
      menuFunc.uidPath = this.treeUidPath;
      dojo.mixin(menuParams, this.treeParams);
    }
    if (menuFunc.classname) {
      while (tree && !tree.isInstanceOf(dijit.Tree)) {
        tree = tree.getParent();
      }
      G_UI_COM.setMenu(this);
      G_SERVER_COM.callServerFunction(menuFunc.classname,menuFunc.functionname,menuFunc.uidPath,menuParams);
    }
  },
  
  _handleGridMenu: function(event,grid,item) {
    this._openMyselfArgs = {target: event.target, coords: {x: event.pageX, y: event.pageY}};
    var menuParams = dojo.clone(grid.store.params_);
    var menuFunc = {};
    if (item.uidpath) {
      if (item.uidpath instanceof Array) {
        menuFunc.uidPath = item.uidpath;
      } else {
        menuFunc.uidPath = [item.uidpath];
      }
    } else {
      menuFunc.uidPath = [item.uid];
    }
    if (item._menufunc_ && item._funcclassname_) {
      menuFunc.classname = item._funcclassname_;
      menuFunc.functionname = item._menufunc_;
    } else {
      if (this.gridClassname) {
        menuFunc.classname = this.gridClassname;
        menuFunc.functionname = this.gridFunctionname;
        dojo.mixin(menuParams, this.gridParams);
        if (this.gridUIDPath) {
          menuFunc.uidPath = this.gridUIDPath;
        }
      }
    }
    if (menuFunc && menuFunc.classname) {
      var selected = grid.getSelectedIds();
      if ((selected.length>1) || (menuFunc.uidPath.length>0) || (selected[0]!=menuFunc.uidPath[0])) {
        menuParams.selected = selected;
      }
      G_UI_COM.setMenu(this);
      G_SERVER_COM.callServerFunction(menuFunc.classname,menuFunc.functionname,menuFunc.uidPath,menuParams);
    }
  }
});

//FilteringSelect
dojo.declare("FIRMOS.FilteringSelect", dijit.form.FilteringSelect, {
  _hidden: false, 
  constructor: function(params) {
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
    this.depGroup_ = new Object();
    if (params.depGroup) {
      var depGroupDef = dojo.fromJson(params.depGroup);
      delete params.depGroup;
      for (var i=0; i<depGroupDef.length; i++) {
        if (!this.depGroup_[depGroupDef[i].inputId]) {
          this.depGroup_[depGroupDef[i].inputId] = new Array();
        }
        this.depGroup_[depGroupDef[i].inputId].push(depGroupDef[i].value);
      }
    }
    this.storeRefreshHandler_ = new Object();
    this.depStores_ = new Array();
    if (params.depStores) {
      var depStoresDef = dojo.fromJson(params.depStores);
      delete params.depStores;
      for (var i=0; i<depStoresDef.length; i++) {
        this.depStores_.push({storeId: depStoresDef[i].storeId, refId: depStoresDef[i].refId});
      }
    }
    if (params.dependentfields) {
      this.depFields_ = dojo.fromJson(params.dependentfields);
      delete(params.dependentfields);
    } else {
      this.depFields_ = {};
    }
  },
  destroy: function(params) {
    for (var i=0; i<this.depStores_.length; i++) {
      G_UI_COM.deleteStoreDependency(this.depStores_[i].storeId,this.depStores_[i].refId);
    }
    this.inherited(arguments);
  },
  postCreate: function() {
    this.inherited(arguments);
    this.refreshDepStores(this.get('value'));
  },
  _refreshDepStoreViews: function(depStore) {
    delete(this.storeRefreshHandler_[depStore.store.id]);
    for (var i=0; i<depStore.views.length; i++) {
      G_UI_COM.refreshView(depStore.views[i]);
    }
  },
  refreshDepStores: function(selection) {
    if (selection=='') {
      var sel = [];
    } else {
      var sel = [selection];
    }
    for (var i=0; i<this.depStores_.length; i++) {
      G_UI_COM.setStoreDependency(this.depStores_[i].storeId,this.depStores_[i].refId,'G',sel);
      var store = G_UI_COM.getStoreById(this.depStores_[i].storeId);
      if (store) {
        //delete handler
        if (this.storeRefreshHandler_[this.depStores_[i].storeId]) {
          clearTimeout(this.storeRefreshHandler_[this.depStores_[i].storeId]);
          delete(this.storeRefreshHandler_[this.depStores_[i].storeId]);
        }
        this.storeRefreshHandler_[this.depStores_[i].storeId] = setTimeout(this._refreshDepStoreViews.bind(this,store),0);
      }
    }
  },
  _updateDepField: function(fieldname,fielddef, forceHide, form) {
    var elem = form.getInputById(fieldname);
    if (elem) {
      var domElem = elem.domNode;
      while (domElem && domElem.tagName!='TR') {
        domElem = domElem.parentNode;
      }
      if (domElem) {
        var doHide = true;
        if (!forceHide) {
          for (var i=0; i<fielddef.length; i++) {
            if (fielddef[i] == this.value) {
              doHide = false;
            }
          }
        }
        doHide = forceHide || doHide;
        if (doHide) {
          dojo.style(domElem,'display','none');
          elem._ignore = true;
          if (elem.get('required')) {
            elem._required = true;
            elem.set('required',false);
          }
          if (elem.isInstanceOf(FIRMOS.FilteringSelect)) {
            elem.hide(form);
          }
        } else {
          dojo.style(domElem,'display','');
          if (elem._ignore) {
            delete elem._ignore;
          }
          if (elem._required) {
            elem.set('required',elem._required);
            delete elem._required;
          }
          if (elem.isInstanceOf(FIRMOS.FilteringSelect)) {
            elem.unhide(form);
          }
        }
      }
    }
  },
  hide: function(form) {
    this._hidden = true;
    this._hideAllDepFields(form);
  },
  unhide: function(form) {
    this._hidden = false;
    this._updateDepGroup(form);
  },
  _updateDepGroup: function(form) {
    for (var i in this.depGroup_) {
      this._updateDepField(i,this.depGroup_[i],false,form);
    }
  },
  _hideAllDepFields: function(form) {
    for (var i in this.depGroup_) {
      this._updateDepField(i,this.depGroup_[i],true,form);
    }
  },
  _updateDepFields: function(form) {
    for (var i in this.depFields_) {
      var elem = form.getInputById(i);
      if (elem) {
        if ((this.get('value')=='' && !this.depFields_[i]) ||
            (this.get('value')!='' && this.depFields_[i])) {
          elem.set('disabled',true);
        } else {
          elem.set('disabled',false);
        }
      }
    }
  },
  init: function() {
    if ((this.value=='') && (this.required || this._required)) {
      if (this.store.data.length>0) {
        this.set('value',this.store.data[0].value);
      }
    }
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      if (this._hidden) {
        this._hideAllDepFields(form);
      } else {
        this._updateDepGroup(form);
      }
      this._updateDepFields(form);
    }
  },
  isValid: function(isFocused) {
    var val = this.get('value');
    if (val || !this.required) {
      return this.inherited(arguments);
    }
    return false;
  },
  onChange: function(value) {
    this.inherited(arguments);
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      if (!this._hidden) this._updateDepGroup(form);
      this._updateDepFields(form);
      form.checkGroupRequiredFields(this);
      form.submitOnChange(this);
    }
    this.refreshDepStores(value);
  }
});

//BoolCheckBox
dojo.declare("FIRMOS.BoolCheckBox", dijit.form.CheckBox, {
  constructor: function(params) {
    if (params.dependentfields) {
      this.depFields = dojo.fromJson(params.dependentfields);
      this.hasDepFields = true;
      delete(params.dependentfields);
    } else {
      this.hasDepFields = false;
      this.depFields = {};
    }
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
  },
  
  updateDepFields: function(form) {
    for (var i in this.depFields) {
      var elem = form.getInputById(i);
      if (elem) {
        if ((this.get('value')=='true' && this.depFields[i]) ||
            (this.get('value')=='false' && !this.depFields[i])) {
          elem.set('disabled',true);
        } else {
          elem.set('disabled',false);
        }
        break;
      }
    }
  },
  onChange: function() {
    this.inherited(arguments);
    if (this.hasDepFields) {
      var form = this.getParent();
      while (form && !form.isInstanceOf(dijit.form.Form)) {
        form=form.getParent();
      }
      if (form && form.isInstanceOf(FIRMOS.Form)) {
        this.updateDepFields(form);
      }
    }
  },
  _getValueAttr: function(){
    return (this.checked ? 'true' : 'false');
  }
});

//MultiValText
dojo.declare("FIRMOS.MultiValText", dijit.form.Textarea, {
  constructor: function(params) {
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
  },
  _getValueAttr: function(){
    var ret = this.inherited(arguments);
    if (ret == '') {
      return [];
    } else {
      return ret.split('\n');
    }
  },
  filter: function(val) {
    if (typeof val == 'object') {
      var ret = this.inherited(arguments,[val.join('\n')]);
    } else {
      var ret = this.inherited(arguments);
    }
    ret = ret.replace(/\n+/g,'\n');
    if (ret.lastIndexOf('\n')==ret.length-1) {
      ret=ret.substring(0,ret.length-1);
    }
    return ret;
  },
  _setBlurValue: function(){
  },
  onChange: function() {
    this.inherited(arguments);
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      form.checkGroupRequiredFields(this);
      form.submitOnChange(this);
    }
  }
});

//ValidationTextBox
dojo.declare("FIRMOS.ValidationTextBox", dijit.form.ValidationTextBox, {
  constructor: function(params) {
    if (params.forbiddenchars) {
      this.regExpForbidden = eval(params.forbiddenchars);
      delete(params.forbiddenchars);
    } else {
      this.regExpForbidden = null;
    }
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
  },
  isValid: function(isFocused) {
    if (this.confirms) {
      var form = this.getParent();
      var main_input = form.getInputById(this.confirms);
      if (main_input) {
        if (this.get('value')!=main_input.get('value')) {
          return false;
        }
      } else {
        console.warn('Confirmation not possible: Input field ' + this.confirms + ' not found!');
      }
    }
    return this.inherited(arguments);
  },
  validate: function(isFocused) {
    if (this.regExpForbidden) {
      var cursorPos = this.textbox.selectionStart;
      var textLength = this.textbox.value.length;
      var newString = this.textbox.value.replace(this.regExpForbidden,'');
      if (newString.length<textLength) {
        this.textbox.value = newString;
        var diff = textLength - newString.length;
        this.textbox.selectionStart = cursorPos-diff;
        this.textbox.selectionEnd = cursorPos-diff;
      }
    }
    return this.inherited(arguments);
  },
  onChange: function() {
    this.inherited(arguments);
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      form.checkGroupRequiredFields(this);
      form.submitOnChange(this);
    }
  }
});

//NumberTextBox
dojo.declare("FIRMOS.NumberTextBox", dijit.form.NumberTextBox, {
  constructor: function(params) {
    if (!params.constraints) {
      params.constraints = {};
    }

    if (params.constraints.places) {
      if (params.constraints.places==0) {
        this.regExpForbidden = /[^\d\-]/g;
      } else {
        this.regExpForbidden =  /[^\d\.\,\-]/g;
        params.constraints.places = '0,' + params.constraints.places;
/*        if (!params.constraints.places) params.constraints.places = 2;
        params.constraints.pattern = '#0.';
        for (var i=0; i<params.constraints.places; i++) {
          params.constraints.pattern = params.constraints.pattern + '#';
        }*/
      }
    }
    
    if (params.grouprequired) {
      this.groupRequired =  eval(params.grouprequired);
      delete params.grouprequired;
    } else {
      this.groupRequired = false;
    }
  },
  _setBlurValue: function() {
  },
  validate: function(isFocused) {
    var cursorPos = this.textbox.selectionStart;
    var textLength = this.textbox.value.length;
    var newString = this.textbox.value.replace(this.regExpForbidden,'');
    if (newString.length<textLength) {
      this.textbox.value = newString;
      var diff = textLength - newString.length;
      this.textbox.selectionStart = cursorPos-diff;
      this.textbox.selectionEnd = cursorPos-diff;
    }
    return this.inherited(arguments);
  },
  _getValueAttr: function() {
    var ret=this.inherited(arguments);
    if (isNaN(ret)) {
      ret='';
    }
    return ret;
  },
  onChange: function() {
    this.inherited(arguments);
    var form = this.getParent();
    while (form && !form.isInstanceOf(dijit.form.Form)) {
      form=form.getParent();
    }
    if (form && form.isInstanceOf(FIRMOS.Form)) {
      form.checkGroupRequiredFields(this);
      form.submitOnChange(this);
    }
  }
});

//NumberSlider
dojo.declare("FIRMOS.NumberSlider", dijit.form._FormValueWidget, {
  templateString: '<div data-dojo-attach-point="focusNode" id="${id}" role="presentation"><div id="${id}_number"></div><div id="${id}_slider"></div></div>',
  constructor: function(params) {
    params.constraints = dojo.fromJson(params.constraints);
    this.sliderParams = {};
    this.sliderParams.minimum = params.constraints.min;
    this.sliderParams.maximum = params.constraints.max;
    if (params.constraints.steps) {
      this.sliderParams.discreteValues = params.constraints.steps;
    }
    this.sliderParams.value = params.value;
    this.sliderParams.intermediateChanges = params.intermediateChanges;
    
    if (params.showvalue) {
      this.showvalue = eval(params.showvalue);
      delete params.showvalue;
    }
    if (this.showvalue) {
      this.sliderParams.style = "width:75%;";

      this.numberParams = {};
      this.numberParams.style = "width:20%; float:right;";
      this.numberParams.value = params.value;
      this.numberParams.places = params.constraints.places;
      this.numberParams.disabled = true;
    }
    this._multi = 1;
    for (var i=0; i<params.constraints.places; i++) {
      this._multi = this._multi * 10;
    }
  },
  startup: function() {
    this.inherited(arguments);
    this.sliderParams.onChange = this._onSliderChange.bind(this);
    if (this.showvalue) {
      this.number = new dijit.form.NumberTextBox(this.numberParams,  this.id + '_number');
    }
    this.slider = new dijit.form.HorizontalSlider(this.sliderParams, this.id + '_slider');
  },
  _onSliderChange: function() {
    var newVal = Math.round(this.slider.get('value')*this._multi)/this._multi;
    if (newVal!=this.value) {
      this.value = Math.round(this.slider.get('value')*this._multi)/this._multi;
      if (this.showvalue) {
        this.number.set('value', this.value);
      }
      var form = this.getParent();
      if (form && form.isInstanceOf(FIRMOS.Form)) {
        form.submitOnChange(this);
      }
    }
  }
});

//TabContainer
dojo.declare("FIRMOS.TabContainer", dijit.layout.TabContainer, {
  constructor: function() {
    this.watch("selectedChildWidget", this.tabChange);
  },
  addTabs: function(tabs) {
    tabs.sort(G_UI_COM.sortFuncSubSecOrd);
    for (var i=0; i<tabs.length; i++) {
      this.addChild(tabs[i]);
      if (!G_UI_COM.showSectionPathInProgress && tabs[i].selected && !tabs[i]._fixContent) {
        this.tabChange('',null,tabs[i]);
      }
    }
  },
  contentLoadedCallback: function(tab, options, success, response, uiState) {
    G_SERVER_COM.handleServerFunctionResponse(options, success, response, uiState);
    if (tab._loadedCallback) {
      tab._loadedCallback();
      delete tab._loadedCallback;
    }
  },
  selectChild: function(child,callback) {
    if (callback) {
      if (child._fixContent) {
        callback();
      } else {
        child._loadedCallback = callback;
      }
    }
    if (!child._fixContent && child.selected) {
      this.tabChange('',null,child);
    }
    this.inherited(arguments);
  },
  selectDefault: function() {
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if (children[i].selected) {
        this.selectChild(children[i]);
        return;
      }
    }
  },
  tabChange: function(name, oval, nval) {
    if (nval._fixContent) {
      var shown = [];
      this._getDescendants(nval,shown,'visibilityChange');
      for (var i=0;i<shown.length;i++) {
        shown[i].visibilityChange(true);
      }
    } else {
      G_SERVER_COM.callServerFunction(nval._contentFunc.class,nval._contentFunc.func,nval._contentFunc.uidPath,nval._contentFuncParams,this.contentLoadedCallback.bind(this,nval),nval._updateId);
    }
    if (this.UIStateChangeClass) {
      var params = this.UIStateChangeParams;
      params.sectionId = nval.id;
      G_SERVER_COM.callServerFunction(this.UIStateChangeClass,this.UIStateChangeFunc,this.UIStateChangeUidPath,params);
    }
    if (oval) {
      if (oval._fixContent) {
        var hidden = [];
        this._getDescendants(oval,hidden,'visibilityChange');
        for (var i=0;i<hidden.length;i++) {
          hidden[i].visibilityChange(false);
        }
      } else {
        var destroyed = [];
        this._getDescendants(oval,destroyed,'destroyNotify');
        if (destroyed.length>0) {
          var dIds = [];
          for (var i=0; i<destroyed.length; i++) {
            dIds.push(destroyed[i].id);
          }
          G_SERVER_COM.callServerFunction("FIRMOS","destroy",null, {ids: dIds});
        }
        var content = null;
        if (oval.isTCElem) {
          var children = oval.getChildren();
          for (var i=0; i<children.length; i++) {
            if (!children[i].isInstanceOf(FIRMOS.Toolbar)) {
              var contentChildren = children[i].getChildren();
              if (contentChildren.length>0) {
                content = contentChildren[0];
              }
              break;
            }
          }
        } else {
          content = oval.getChildren()[0];
        }
        if (content) {
          content.destroyRecursive();
        }
      }
    }
  },
  _getDescendants: function(container, des, property) {
    if (container[property]) {
      des.push(container);
    }

    var children = container.getChildren();
    for (var i=0; i<children.length; i++) {
      if (!container.isInstanceOf(FIRMOS.TabContainer) || children[i].selected) {
        this._getDescendants(children[i], des, property);
      }
    }
  },
  getChild: function(childId) {
    var children = this.getChildren();
    for (var i=0; i<children.length; i++) {
      if (children[i].id == childId) {
        return children[i];
      }
    }
    return null;
  }
});

//MultiContentTabController
dojo.declare("FIRMOS.MultiContentTabController",null, {
  constructor: function() {
    this.domNode = dojo.create('div');
  },
  startup: function() {
  },
  destroy: function() {
    dojo.destroy(this.domNode);
  }
});

//MultiContentContainer
dojo.declare("FIRMOS.MultiContentContainer", FIRMOS.TabContainer, {
   baseClass: "firmosMultiContentContainer",
   constructor: function(args) {
     this.animationSpeed = 20;
     this.animationStep = 0.1;
     this.controllerWidget = FIRMOS.MultiContentTabController;
   },
   addTabs: function(tabs) {
     this.inherited(arguments);
     for (var i=0; i<tabs.length; i++) {
        tabs[i].domNode.style.position = 'absolute';
     }
   },
  _animateHideChild: function(widget, value) {
    if (value<0) {
      widget.domNode.style.opacity = 0;
      this.hideChildTO = null;
      this._hideChild(widget, true);
    } else {
      widget.domNode.style.opacity = value;
      this.hideChildTO = setTimeout(this._animateHideChild.bind(this, widget, value - this.animationStep),this.animationSpeed);
    }
  },
  _hideChild: function(widget, hide) {
    if (this.hideChildTO) {
      clearTimeout(this.hideChildTO);
      this.hideChildTO = null;
      this.inherited(this.hideArgs);
      this.hideArgs = arguments;
    } else {
      if (!this.hideArgs) this.hideArgs = arguments;
    }
    if (hide) {
      this.inherited(this.hideArgs);
      this.hideArgs = null;
    } else {
      this._animateHideChild(widget, 1);
    }
  },
  _animateShowChild: function(widget, value) {
    if (value>1) {
      this.showChildTO = null;
      widget.domNode.style.opacity = 1;
    } else {
      widget.domNode.style.opacity = value;
      this.showChildTO=setTimeout(this._animateShowChild.bind(this, widget, value + this.animationStep),this.animationSpeed);
    }
  },
  _showChild: function(widget) {
    if (this.showChildTO) {
      clearTimeout(this.showChildTO);
      this.showChildTO = null;
    }
    this.inherited(arguments);
    widget.domNode.style.opacity = 0;
    this._animateShowChild(widget,0);
  }
});

//SplitContainer
dojo.declare("FIRMOS.SplitContainer", dijit.layout.BorderContainer, { 
  addChildren: function(childArray) {
    var child;
    if (childArray.length>2) {
      child = childArray.shift();
      child.region='top';
      var centerHeight = 100 - child._height;
      child.set('style','height: '+child._height+'%;');
      this.addChild(child);
      child = childArray.pop();
      child.region='bottom';
      centerHeight = centerHeight - child._height;
      child.set('style','height: '+child._height+'%;');
      this.addChild(child);
      var childContainer = new FIRMOS.SplitContainer({
        id: this.id + '_child',
        class: 'borderContainer',
        region: 'center',
        gutters: false
      });
      childContainer.set('style','height: '+centerHeight+'%;');
      for (var i=0; i<childArray.length; i++) {
        childArray[i]._height = (childArray[i]._height / centerHeight) * 100;
      }
      this.addChild(childContainer);
      childContainer.addChildren(childArray);
    } else {
      if (childArray.length==2) {
        child = childArray.shift();
        child.region='top';
        child.set('style','height: '+child._height+'%;');
        this.addChild(child);
      }
      child = childArray.pop();
      child.region='center';
      child.set('style','height: '+child._height+'%;');
      this.addChild(child);
    }
  }
});

//GridFilter
dojo.declare("FIRMOS.GridFilter",null, {
  texts: G_TEXTS.gridfilter,
  renderHeader: function(){
    this.inherited(arguments);
    if (this.filterDisabled) return;
      
    var headerNodes = dojo.query(".dgrid-cell", this.headerNode);
    for (var i=0; i<headerNodes.length; i++) {
      var colId = headerNodes[i].columnId;
      if (!this.columns[colId]) continue;
      if (!this.columns[colId].filterable) continue;
      if (!this.columns[colId].dataType || this.columns[colId].dataType=='ICO') continue;

      var button = dijit.byId(this.id+'_'+colId+'_ddb');
      if (!button) {
        switch (this.columns[colId].dataType) {
          case 'STR':
            var filter_dialog_content = this.getStringFilterDialog(this.columns[colId]);
            var set_function = 'setStringFilter';
            break;
          case 'DAT':
            var filter_dialog_content = this.getDateFilterDialog(this.columns[colId]);
            var set_function = 'setDateFilter';
            break;
          case 'NUM':
          case 'PRG':
          case 'CUR':
            var filter_dialog_content = this.getNumberFilterDialog(this.columns[colId]);
            var set_function = 'setNumberFilter';
            break;
//          case 'ICO':
//            var filter_dialog_content = this.getIconFilterDialog(this.columns[colId]);
//            var set_function = 'setIconFilter';
//            break;
          case 'BOO':
            var filter_dialog_content = this.getBooleanFilterDialog(this.columns[colId]);
            var set_function = 'setBooleanFilter';
            break;
          default:
            console.error('Grid filter error: Unknown data type set for column "' + this.columns[colId].label.replace(/"/g,'\"') + '": ' + this.columns[colId].dataType);
            continue;
            break;
        }
        filter_dialog_content = '<form dojoType="dijit.form.Form" id="'+this.id+'_'+colId+'" onsubmit="return false;">'+
                                '<table style="width:100%">'+
                                filter_dialog_content +
                                '<tr><td colspan="2" class="firmosGridFilterDialogButtons">' +
                                '<button data-dojo-type="dijit.form.Button" type="button" '+
                                         'onClick="var ttd=this.getParent().getParent(); '+
                                         'ttd.formValues=ttd.getChildren()[0].get(\'value\'); '+ //FIXXME set on grid
                                         'ttd.grid.'+set_function+'(\''+colId+'\',ttd.formValues); '+
                                         'ttd.ddbutton.closeDropDown();">'+this.texts.setButton+'</button>'+
                                '<button data-dojo-type="dijit.form.Button" type="button" '+
                                         'onClick="var ttd=this.getParent().getParent(); '+
                                         'ttd.formValues=ttd.getChildren()[0].reset(); '+
                                         'ttd.formValues=ttd.getChildren()[0].get(\'value\'); '+  //FIXXME set on grid
                                         'ttd.grid.clearFilter(\''+colId+'\'); '+
                                         'ttd.ddbutton.closeDropDown();">'+this.texts.clearButton+'</button>'+
                                '</td></tr>'+
                                '</table>'+
                                '</form>';

        var filter_dialog = new dijit.TooltipDialog({id: this.id+'_'+colId + '_td',
                                                     class: "firmosGridFilterDialog"+this.columns[colId].dataType,
                                                     content: filter_dialog_content,
                                                     onShow: function(event) {this.formValues = this.getChildren()[0].get('value');},
                                                     onOpen: function(event) {this.getChildren()[0].set('value',this.formValues);}, // FIXXME get from grid
                                                     grid: this});

        var button = new dijit.form.DropDownButton({
          id: this.id+'_'+colId + '_ddb',
          label: '',
          dropDown: filter_dialog,
          class: "firmosGridFilter",
          iconClass: "firmosGridFilterIconClass",
          onClick: function (evt) {evt.preventDefault(); dojo.stopEvent(evt); return false;}
        });
        filter_dialog.ddbutton = button;
      }
      headerNodes[i].appendChild(button.domNode);
    }
  },
  clearFilter: function(columnId) {
    G_UI_COM.deleteStoreDependency(this.store.id,columnId);
    var ddbutton = dojo.query('.firmosGridFilter', this.column(columnId).headerNode);
    dojo.removeClass(ddbutton[0],'firmosGridFilterSet');
    this.refresh();
  },
  setStringFilter: function(columnId, filter) {
    if (filter.filter=='') {
      this.clearFilter(columnId);
      return;
    }
    G_UI_COM.setStoreDependency(this.store.id,columnId,'T',[filter.filter]);
    this.filterSet(columnId);
  },
  setNumberFilter: function(columnId, filter) {
    if (filter.type==this.texts.numberOptions.gtlt) {
      if ((filter.value1==='') && (filter.value2==='')) {
        this.clearFilter(columnId);
        return;
      }
    } else {
      if (filter.value==='') {
        this.clearFilter(columnId);
        return;
      }
    }
    if (this.column(columnId).dataType=='CUR') {
      var depType='C';
    } else {
      var depType='S';
    }
    switch (filter.type) {
      case this.texts.numberOptions.eq:
        G_UI_COM.setStoreDependency(this.store.id,columnId,depType,[filter.value],'EX');
        break;
      case this.texts.numberOptions.lt:
        G_UI_COM.setStoreDependency(this.store.id,columnId,depType,[filter.value],'LE');
        break;
      case this.texts.numberOptions.gt:
        G_UI_COM.setStoreDependency(this.store.id,columnId,depType,[filter.value],'GT');
        break;
      case this.texts.numberOptions.gtlt:
        G_UI_COM.setStoreDependency(this.store.id,columnId,depType,[filter.value1,filter.value2],'REXB');
        break;
    }
    this.filterSet(columnId);
  },
  setDateFilter: function(columnId, filter) {
    if (filter.type==this.texts.dateOptions.gtlt) {
      if ((!filter.value1) && (!filter.value2)) {
        this.clearFilter(columnId);
        return;
      }
    } else {
      if (!filter.value) {
        this.clearFilter(columnId);
        return;
      }
    }
    switch (filter.type) {
      case this.texts.dateOptions.eq:
        var dayrange_start=new Date(filter.value.getTime());
            dayrange_start.setHours(0,0,0,0);
        var dayrange_end=new Date(filter.value.getTime());
            dayrange_end.setHours(23,59,59,999);           
        G_UI_COM.setStoreDependency(this.store.id,columnId,'D',[dayrange_start.getTime(),dayrange_end.getTime()],'RWIB');
        break;
      case this.texts.dateOptions.lt:
        G_UI_COM.setStoreDependency(this.store.id,columnId,'D',[filter.value.getTime()],'LE');
        break;
      case this.texts.dateOptions.gt:
        G_UI_COM.setStoreDependency(this.store.id,columnId,'D',[filter.value.getTime()],'GT');
        break;
      case this.texts.dateOptions.gtlt:
        var fv1=new Date(filter.value1);
            fv1.setHours(0,0,0,0);
        var fv2=new Date(filter.value2);
            fv2.setHours(23,59,59,999);
        G_UI_COM.setStoreDependency(this.store.id,columnId,'D',[fv1.getTime(),fv2.getTime()],'RWIB');
        break;
    }
    this.filterSet(columnId);
  },
  setIconFilter: function(columnId, filter) {
    this.filterSet(columnId);
  },
  setBooleanFilter: function(columnId, filter) {
    G_UI_COM.setStoreDependency(this.store.id,columnId,'B',[filter.filter]);
    this.filterSet(columnId);
  },
  filterSet: function(columnId) {
    var ddbutton = dojo.query('.firmosGridFilter', this.column(columnId).headerNode);
    dojo.addClass(ddbutton[0],'firmosGridFilterSet');
    this.refresh();
  },
  getStringFilterDialog: function(column) {
    var content = '<tr><td colspan=2 class="firmosGridFilterFormInputTD2Col"><input data-dojo-type="dijit.form.TextBox" id="'+this.id+'_'+column.id+'_filter" name="filter" style="width:100%"></td></tr>';
    return content;
  },
  numberFilterTypeChange: function(newValue,id,input) {
    var v = dijit.byId(id+'_value');
    var v1 = dijit.byId(id+'_value1');
    var v2 = dijit.byId(id+'_value2');
    if (newValue==this.texts.numberOptions.gtlt) {
      dojo.style(v.domNode,'display','none');
      dojo.style(v1.domNode,'display','');
      dojo.style(v2.domNode,'display','');
    } else {
      dojo.style(v.domNode,'display','');
      dojo.style(v1.domNode,'display','none');
      dojo.style(v2.domNode,'display','none');
    }
  },
  dateFilterTypeChange: function(newValue,id,input) {
    var v = dijit.byId(id+'_value');
    var v1 = dijit.byId(id+'_value1');
    var v2 = dijit.byId(id+'_value2');
    if (newValue==this.texts.dateOptions.gtlt) {
      dojo.style(v.domNode,'display','none');
      dojo.style(v1.domNode,'display','');
      dojo.style(v2.domNode,'display','');
    } else {
      dojo.style(v.domNode,'display','');
      dojo.style(v1.domNode,'display','none');
      dojo.style(v2.domNode,'display','none');
    }
  },
  getNumberFilterDialog: function(column) {
    var content = '<tr><td class="firmosGridFilterFormLabelTD">'+
                      '<select id="'+this.id+'_'+column.id+'_type" data-dojo-type="dijit.form.ComboBox" style="width:100%" name="type" '+
                      'data-dojo-props="onChange:function(value) {var ttd=this.getParent().getParent(); ttd.grid.numberFilterTypeChange(value,\''+this.id+'_'+column.id+'\',this);}">'+
                      '<option>'+this.texts.numberOptions.eq+'</option>'+
                      '<option>'+this.texts.numberOptions.lt+'</option>'+
                      '<option>'+this.texts.numberOptions.gt+'</option>'+
                      '<option>'+this.texts.numberOptions.gtlt+'</option>'+
                      '</select></td>'+
                      '<td class="firmosGridFilterFormInputTD"><input data-dojo-type="FIRMOS.NumberTextBox" id="'+this.id+'_'+column.id+'_value" name="value" style="width:100%">'+
                      '<input data-dojo-type="FIRMOS.NumberTextBox" id="'+this.id+'_'+column.id+'_value1" name="value1" style="display: none; width:45%; float: left;">'+ 
                      '<input data-dojo-type="FIRMOS.NumberTextBox" id="'+this.id+'_'+column.id+'_value2" name="value2" style="display: none; width:45%; float: right;"></td></tr>';
    return content;
  },
  getDateFilterDialog: function(column) {
    var content = '<tr><td class="firmosGridFilterFormLabelTD">'+
                      '<select id="'+this.id+'_'+column.id+'_type" data-dojo-type="dijit.form.ComboBox" style="width:100%" name="type" '+
                      'data-dojo-props="onChange:function(value) {var ttd=this.getParent().getParent(); ttd.grid.dateFilterTypeChange(value,\''+this.id+'_'+column.id+'\',this);}">'+
                      '<option>'+this.texts.dateOptions.eq+'</option>'+
                      '<option>'+this.texts.dateOptions.lt+'</option>'+
                      '<option>'+this.texts.dateOptions.gt+'</option>'+
                      '<option>'+this.texts.dateOptions.gtlt+'</option>'+
                      '</select></td>'+
                      '<td class="firmosGridFilterFormInputTD"><input data-dojo-type="FIRMOS.DateTextBox" id="'+this.id+'_'+column.id+'_value" name="value" style="width:100%">'+
                      '<input data-dojo-type="FIRMOS.DateTextBox" id="'+this.id+'_'+column.id+'_value1" name="value1" style="display: none; width:45%; float: left;">'+ 
                      '<input data-dojo-type="FIRMOS.DateTextBox" id="'+this.id+'_'+column.id+'_value2" name="value2" style="display: none; width:45%; float: right;"></td></tr>';
    return content;
  },
  getIconFilterDialog: function(column) {
    return '';
  },
  getBooleanFilterDialog: function(column) {
    var content = '<tr><td colspan=2 class="firmosGridFilterFormInputTD2Col">'+
                        '<select data-dojo-type="dojox.form.CheckedMultiSelect" style="width:100%" id="'+this.id+'_'+column.id+'_filter" name="filter" value="true">'+
                        '<option value="true">Yes</option>'+
                        '<option value="false">No</option>'+
                        '</select>'+
                      '</td></tr>';
    return content;
  }
});

//StoreSeries
dojo.declare("FIRMOS.StoreSeries", null, {
  constructor: function(store, kwArgs, value, chartId) {
    this.chartId = chartId;
    this.store = store;
    this.kwArgs = kwArgs;
  
    if(value){
      if(typeof value == "function"){
        this.value = value;
      }else if(typeof value == "object"){
        this.value = function(object){
          var o = {};
          for(var key in value){
            o[key] = object[value[key]];
          }
          return o;
        };
      }else{
        this.value = function(object){
          return object[value];
        };
      }
    }else{
      this.value = function(object){
        return object.value;
      };
    }
  
    this.data = [];

    this._initialRendering = false;
    this.fetch();
  },
  
  destroy: function(){
    if(this.observeHandle){
      this.observeHandle.remove();
    }
  },
  
  setSeriesObject: function(series){
    this.series = series;
  },

  fetch: function(){
    // summary:
    //    Fetches data from the store and updates a chart.
    var objects = this.objects = [];
    var self = this;
    if(this.observeHandle){
      this.observeHandle.remove();
    }
    var results = this.store.query(this.kwArgs.query, this.kwArgs);
    dojo.Deferred.when(results, function(objects){
      self.objects = objects;
      update();
    });
    if(results.observe){
      this.observeHandle = results.observe(update, true, this.chartId);
    }
    function update(){
      self.data = dojo.array.map(self.objects, function(object){
        return self.value(object, self.store);
      });
      self._pushDataChanges();
    }
  },

  _pushDataChanges: function(){
    if(this.series){
      this.series.chart.updateSeries(this.series.name, this, this._initialRendering);
      this._initialRendering = false;
      this.series.chart.delayedRender();
    }
  }

});

//D3Chart
dojo.declare("FIRMOS.D3Chart", dijit.layout.ContentPane, {
  constructor: function(args) {
    for (var i in args) {
      this[i] = args[i];
    }
    if (!this.seriesColor) {
      this.seriesColor = [];
      for (var i=0; i<this.seriesCount; i++) {
        this.seriesColor[i]='000';
      }
    }
    G_UI_COM.createCSSRule("d3axis path, .axis line","fill: none;shape-rendering: crispedges;stroke: #000000;");
    this._events = new Array();
    this.container = null;
    this.svg = null;
    this.svgMainG = null;
    this.clipPath = null;
    this.clipPathRect = null;
    this.chartCaption = null;
    this.scale_x = null;
    this.scale_y = null;
    this.margin = { top: 20, right: 20, bottom: 20, left: 40};
    this.axisY = null;
    this.axisYG = null;
    this.stopped = true;
    
    this.axisX = null;
    this.axisXG = null;
    this.axisXMargin = 0;
    this.axisY = null;
    this.axisYG = null;
    
    this.legend = null;
    this.legendItems = [];
    this.legendSize = 0;
    
    this.newLines = [];
    
    switch (args.type) {
      case 'lct_line':
        this.dataIdx = 0;
        this.buffer = [];
        this._animationTime = this.updateInterval;
        this._animationStart_1 = new Date();
        this._animationStart_2 = new Date();
        this._oldAnimationTime_1 = this.updateInterval;
        this._oldAnimationTime_2 = this.updateInterval;
        this._doNotCalc = 0;
        this._dataToLate = 0;
        break;
      case 'lct_sampledline':
        break;
      case 'lct_column':
        this.data = [];
        this.rects = [];
        break;
    }
    
    this.dummyData = this.dataMin - this.dataMax;
    this.domainX = [];
    if ((args.type=='lct_line') || (args.type=='lct_sampledline')) {
      this.interpolation = "linear";
      this.path = [];
      this.line = [];
      this.data = [];
    }
    
    G_UI_COM.registerLiveChart(this);
  },
  visibilityChange: function(visible) {
    if (visible) {
      this.start();
    } else {
      this.stop();
    }
  },
  destroy: function() {
    this.stop();
    G_UI_COM.unregisterLiveChart(this);
    this._removeSeriesCSS();
    while (this._events.length>0) {
      this._events.pop().remove();
    }
    this.inherited(arguments);
  },
  redefine: function(def) {
    var height_changed = false;
    if (def.caption && this.caption!=def.caption) {
      this.caption = def.caption
      this.chartCaption.text(this.caption);
    }
    if (def.dataLabels) {
      this.dataLabels = def.dataLabels;
    }
    
    if (def.dataCount && this.dataCount!=def.dataCount) {
      switch (this.type) {
        case 'lct_line':
          this.domainX = [1, def.dataCount-2];
          for (var i=0; i<this.seriesCount; i++) {
            if (def.dataCount>this.dataCount) {
              for (var j=0; j<def.dataCount-this.dataCount; j++) {
                this.data[i].unshift(this.dummyData);
              }
            } else {
              for (var j=0; j<this.dataCount-def.dataCount; j++) {
                this.data[i].shift();
              }
            }
          }
          break;
        case 'lct_sampledline':
          this.domainX = [0, def.dataCount-1];
          break;
        case 'lct_column':
          if (this.dataLabels) {
            this.domainX = d3.range(def.dataCount).map(function(i) {return this.dataLabels[i];}.bind(this));
          } else {
            this.domainX = d3.range(def.dataCount).map(function(i) {return i;});
          }
          break;
      }
      this.dataCount = def.dataCount;
      this.scale_x.domain(this.domainX);
    }

    if (def.dataLabels || (def.dataCount && this.dataCount!=def.dataCount)) {
      this.axisXG.call(this.axisX).selectAll("text").style("text-anchor", "end");
      this._adjustAxisX();
      height_changed = true;
    }

    if (def.seriesColor || (def.seriesCount && this.seriesCount!=def.seriesCount)) {
      this._removeSeriesCSS();
    }

    if (def.seriesColor) {
      this.seriesColor = def.seriesColor;
    }
    
    if (def.seriesCount && this.seriesCount!=def.seriesCount) {
      if (def.seriesCount>this.seriesColor.length) {
        for (var i=this.seriesColor.length; i<def.seriesCount; i++) {
          this.seriesColor[i]='000';
        }
      } else {
        if (def.seriesCount<this.seriesColor.length) {
          for (var i=this.seriesColor.length-1; i>=def.seriesCount; i--) {
            this.seriesColor.pop();
          }
        }
      }
      if (def.seriesCount>this.seriesCount) {
        for (var i=this.seriesCount; i<def.seriesCount; i++) {
          if (this.type=='lct_line') {
            this.buffer[i] = [];
            var bufferSize = (this.seriesCount == 0) ? this.bufferSize+1 : this.buffer[0].length;
            for (var j=0; j<bufferSize; j++) {
              this.buffer[i][j] = this.dummyData;
            }
            if (this.seriesCount==0) {
              setTimeout(this.updateData.bind(this,i),0);
            } else {
              this.newLines.push(i);
            }
          }
          if ((this.type=='lct_line') || (this.type=='lct_sampledline')) {
            this.data[i] = d3.range(this.dataCount).map(function() {return this.dummyData;}.bind(this));
            this._createLine(i);
          }
        }
      } else {
        for (var i=this.seriesCount-1; i>=def.seriesCount; i--) {
          if (this.type=='lct_line') {
            this.buffer.pop();
          }
          if ((this.type=='lct_line') || (this.type=='lct_sampledline')) {
            this.data.pop();
            this.line.pop();
            this.path.pop().remove();
          }
        }
      }
      this.seriesCount = def.seriesCount;
    }

    if (def.seriesColor || (def.seriesCount && this.seriesCount!=def.seriesCount)) {
      this._createSeriesCSS();
    }
    
    if ((this.legendLabels && (def.seriesColor || (def.seriesCount && this.seriesCount!=def.seriesCount))) || (def.legendLabels)) {
      if (this.legendLabels) {
        this.legend.remove();
      } else {
        this.margin.bottom = this.margin.bottom + 20;
        height_changed = true;
      }
      if (def.legendLabels) {
        this.legendLabels = def.legendLabels;
      }
    }

    if (height_changed) {
      var dim = dojo.position(this.container);
      this.height = dim.h - this.margin.top - this.margin.bottom;
      this.clipPathRect.attr("height", this.height);
      this.scale_y.range([this.height, 0]);
      if (this.axisXG) {
        this.axisXG.attr("transform", "translate(0," + this.height + ")");
      }
    }
    
    if (def.dataMin || def.dataMax) {
      if (def.dataMin) this.dataMin = def.dataMin;
      if (def.dataMax) this.dataMax = def.dataMax;
      this.scale_y.domain([this.dataMin,this.dataMax]);
      this.axisYG.call(this.axisY);
    }
    
    if ((this.legendLabels && (def.seriesColor || (def.seriesCount && this.seriesCount!=def.seriesCount))) || (def.legendLabels)) {
      this._paintLegend();
    }
    this._paintData();
  },
  _removeSeriesCSS: function() {
    for (var i=0; i<this.seriesCount; i++) {
      G_UI_COM.removeCSSRule("series"+this.id+'_'+i);
    }
  },
  _createSeriesCSS: function() {
    if ((this.type=='lct_line') || (this.type=='lct_sampledline')) {
      for (var i=0; i<this.seriesCount; i++) {
        G_UI_COM.createCSSRule("series"+this.id+'_'+i,"fill: none; stroke: #"+this.seriesColor[i]+"; stroke-width: 1.5px;");
      }
    }
    if (this.type=='lct_column') {
      for (var i=0; i<this.seriesCount; i++) {
        G_UI_COM.createCSSRule("series"+this.id+'_'+i,"fill: #"+this.seriesColor[i]);
      }
    }
  },
  _paintData: function() {
    switch (this.type) {
      case 'lct_line':
      case 'lct_sampledline':
        this.scale_x.range([0, this.width]);
        for (var i=0; i<this.seriesCount; i++) {
          this.path[i].attr("d", this.line[i]);
        }
        break;
      case 'lct_column':
        this.scale_x.rangeRoundBands([0, this.width],0.1);
        this._paintColumns();
        break;
    }
  },
  applyScale: function() {
    var dim = dojo.position(this.container);
    this.width = dim.w - this.margin.left - this.margin.right;
    this.height = dim.h - this.margin.top - this.margin.bottom;
    this.svg.attr("width", this.width + this.margin.left + this.margin.right).attr("height", this.height + this.margin.top + this.margin.bottom);
    this.clipPathRect.attr("width", this.width).attr("height", this.height);

    this.scale_y.range([this.height, 0]); 
    this.axisYG.call(this.axisY);

    this._paintData();

    if (this.axisXG) {
      this.axisXG.attr("transform", "translate(0," + this.height + ")").call(this.axisX).selectAll("text").style("text-anchor", "end");
    }

    if (this.chartCaption) {
      this.chartCaption.attr("x", (this.width / 2)).attr("y", - (this.margin.top-20));
    }
  },
  postCreate: function() {
    this.inherited(arguments);
    this.set('content','<div id="'+this.id+'_container" style="width:100%; height:100%;"></div>');
    this.set('style','overflow: hidden');
    setTimeout(this.createChart.bind(this),0);
  },
  stop: function() {
    this.stopped = true;
    this.sfParams.action = "stop";
    G_SERVER_COM.callServerFunction(this.sfClass,this.sfFunc,this.sfUidPath, this.sfParams);
  },
  start: function() {
    if (!this.stopped) return; //already running;
    this.stopped = false;
    switch (this.type) {
      case 'lct_line':
        for (var i=0; i<this.seriesCount; i++) {
          this._createLine(i);
        }
        this.dataIdx = 0;
        for (var i=0; i<this.seriesCount; i++) {
          this.buffer[i] = [];
          for (var j=0; j<=this.bufferSize; j++) {
            this.buffer[i][j] = this.dummyData;
          }
        }
        break;
      case 'lct_sampledline':
        for (var i=0; i<this.seriesCount; i++) {
          this._createLine(i);
        }
        break;
      case 'lct_column':
        break;
    }
    if (this.initClass) {
      G_SERVER_COM.callServerFunction(this.initClass,this.initFunc,this.initUidPath, this.initParams, this._initCallback.bind(this));
    } else {
      this._start();
    }
  },
  _initData: function() {
    for (var i=0; i<this.seriesCount; i++) {
      this.data[i] = d3.range(this.dataCount).map(function() {return this.dummyData;}.bind(this));
    }
  },
  _createLine: function(idx) {
    this.line[idx] = d3.svg.line().interpolate(this.interpolation)
                         .x(function(d, i) { return this.scale_x(i); }.bind(this))
                         .y(function(d, i) { return this.scale_y(d); }.bind(this));
    this.path[idx] = this.svgMainG.append("g").attr("clip-path", "url(#clip)")
                                  .append("path").data([this.data[idx]]).attr("class", "series"+this.id+'_'+idx).attr("d", this.line[idx]);
  },
  _initCallback: function(options, success, response, uiState) {
    if (success) {
      var json_result = dojo.fromJson(response.output);
      switch (this.type) {
        case 'lct_line':
          for (var i=0; i<json_result.length; i++) {
            var idx = this.bufferSize+1;
            var fillBuffer = true;
            this.buffer[i] = [];
            for (var j=json_result[i].length-1; j>=0; j--) {
              if (fillBuffer) { //Fill the buffer first
                idx--;
                this.buffer[i][idx] = json_result[i][j];
                if (idx == 0) {
                  fillBuffer = false;
                  idx = this.dataCount;
                }
              } else { //Fill the data
                idx--;
                this.data[i][idx] = json_result[i][j];
                if (idx == 0) {
                  break;
                }
              }
            }
            if (fillBuffer && (idx>0)) {
              for (var j=idx-1; j>=0; j--) {
                this.buffer[i][j] = this.dummyData;
              }
            }
            if (fillBuffer) {
              idx = this.dataCount;
            }
            if (idx>0) { //data not fully set => fill with dummy data
              for (var j=idx-1; j>=0; j--) {
                this.data[i][j] = this.dummyData;
              }
            }
          }
          if (this.seriesCount>json_result.length) {
            for (var i=json_result.length; i<this.seriesCount; i++) {
              this._fillWithDummyData(i);
            }
          }
          break;
        case 'lct_sampledline':
        case 'lct_column':
          this.setData(json_result);
          break;
      }
      this._start();
    } else {
      console.error('Server Function Error => '+response.cn + '.' + response.fn + ': ' + response.error);
    }
  },
  _start: function() {
    this.sfParams.action = "start";
    G_SERVER_COM.callServerFunction(this.sfClass,this.sfFunc,this.sfUidPath, this.sfParams);
    switch (this.type) {
      case 'lct_line':
        this._animationStart_1 = new Date() - this.updateInterval;
        this._animationStart_2 = this._animationStart_1 - this.updateInterval;
        this._oldAnimationTime_1 = this.updateInterval;
        this._oldAnimationTime_2 = this.updateInterval;
        this._doNotCalc = 0;
        for (var i=0; i<this.seriesCount; i++) {
          this.updateData(i);
        }
        break;
      case 'lct_sampledline':
        break;
      case 'lct_column':
        break;
    }
  },
  setData: function(data,idx) {
    if (this.stopped) return;
    switch (this.type) {
      case 'lct_line':
        this._setLineData(data,idx);
        break;
      case 'lct_sampledline':
        this._setSampledLineData(data);
        break;
      case 'lct_column':
        this._setColumnData(data);
        break;
    }
  },
  _setSampledLineData: function(data) {
    if (this._setCompleteData(data)) {
      for (var i=0; i<this.seriesCount; i++) {
        this.path[i].attr("d", this.line[i]);
      }
    }
  },
  _setLineData: function(data,idx) {
    if (data.length!=this.seriesCount) {
      console.error('Live Chart ' + this.id + ': received data points count ('+data.length+') does not match series count ('+this.seriesCount+')');
      return;
    }
    if (this.dataIdx == idx) { //expected data entry
      for (var i=0; i<this.seriesCount; i++) {
        this.buffer[i].push(data[i]);
      }
      this.dataIdx++;
    } else {
      if (idx<this.dataIdx) {
        //console.log(this.id + ' DATA TO LATE');
        this._dataToLate = 10 * this.bufferSize;
        //skip it - data came to late - dummy data used
      } else {
        //console.log(this.id + ' MISSED SOME POINTS');
        //missed some points?
        for (var i=0; i<this.seriesCount; i++) {
          for (var j=0; j<(idx-this.dataIdx); j++) {
            this.buffer[i].push(this.dummyData);
          }
          this.buffer[i].push(data[i]);
          this.dataIdx=this.dataIdx+(idx-this.dataIdx)+1;
        }
      }
    }
  },
  _setColumnData: function(data) {
    if (this._setCompleteData(data)) {
      this._paintColumns();
    }
  },
  _setCompleteData: function(data) {
    if (data.length!=this.seriesCount) {
      console.error('Live Chart ' + this.id + ': received data sets count ('+data.length+') does not match series count ('+this.seriesCount+')');
      return false;
    }
    for (var i=0; i<this.seriesCount; i++) {
      for (var j=0; j<data[i].length; j++) {
        if (data[i].length!=this.dataCount) {
          console.error('Live Chart ' + this.id + ': received data count ('+data[i].length+') for set ' + i + ' does not match data count ('+this.dataCount+')');
          return false;
        }
        this.data[i][j] = data[i][j];
      }
    }
    return true;
  },
  updateData: function(seriesId) {
    if (this.stopped) return;
    if (this.seriesCount<=seriesId) {
      if (this._doNotCalc) {
        this._doNotCalc = this._doNotClac - 1;
      }
      return;
    }
    if (this.buffer[seriesId].length==0) {
      //add dummy data to all buffers
      //console.log(this.id + ' NO DATA ' + seriesId);
      this.dataIdx++;
      for (var i=0; i<this.seriesCount; i++) {
        this.buffer[i].push(this.dummyData);
      }
    }
    // push a new data point onto the back
    this.data[seriesId].push(this.buffer[seriesId].shift());

    if (this._doNotCalc) {
      this._doNotCalc = this._doNotClac - 1;
    } else {
      this._doNotCalc = this.seriesCount-1;
      this._animationTime = this.updateInterval - ((this._animationStart_1 - this._animationStart_2) - this._oldAnimationTime_2);

      if (this._animationTime < (this.updateInterval / 2)) {
        this._animationTime = this.updateInterval / 2;
      }
      if (this.buffer[seriesId].length>this.bufferSize) { //buffer to big - go faster
        this._animationTime = this._animationTime - (this.updateInterval / 10);
        //console.log(this.id + ' BUFFER TO BIG ');
      }
      if (this.buffer[seriesId].length<this.bufferSize) { //buffer to small - slow down
        //console.log(this.id + ' BUFFER TO SMALL');
        this._dataToLate = 10;
      }
      if (this._dataToLate) {  //data to late - slow down
        this._dataToLate = this._dataToLate - 1;
        this._animationTime = this._animationTime + (this.updateInterval / 10);
        //console.log(this.id + ' DATA LATE/BUFFER SMALL ' + this._dataToLate);
      }
      this._oldAnimationTime_2 = this._oldAnimationTime_1;
      this._oldAnimationTime_1 = this._animationTime;

      this._animationStart_2 = this._animationStart_1;
      this._animationStart_1 = new Date();
      while (this.newLines.length>0) {
        setTimeout(this.updateData.bind(this,this.newLines.pop()),0);
      }
    }
    // redraw the line, and then slide it to the left
    this.path[seriesId].attr("d", this.line[seriesId]).attr("transform", null)
                  .transition().duration(this._animationTime).ease("linear").attr("transform", "translate(" + this.scale_x(0) + ")")
                  .each("end", this.updateData.bind(this,seriesId));
    // pop the old data point off the front
    this.data[seriesId].shift();
    
  },
  createChart: function() {
    this.container = dojo.byId(this.id+'_container');
    this._initData();
    this._createSeriesCSS();

    if (this.caption!='') {
      this.margin.top = this.margin.top + 20;
    }
    if (this.legendLabels) {
      this.margin.bottom = this.margin.bottom + 20;
    }
    var dim = dojo.position(this.container);
    
    this.svg = d3.select(this.container).append("svg").attr("width", dim.w).attr("height", dim.h);
    this.svgMainG = this.svg.append("g").attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        
    this.width = dim.w - this.margin.left - this.margin.right;

    if (this.captiom!='') {
      this.chartCaption = this.svgMainG.append("text").attr("x", (this.width / 2)).attr("y", - (this.margin.top-20))
          .attr("text-anchor", "middle").attr("class", "firmosLiveChartCaption")
          .text(this.caption);
    }
    
    switch (this.type) {
      case 'lct_line':
        this.domainX = [1, this.dataCount-2];
        this.scale_x = d3.scale.linear().domain(this.domainX).range([0, this.width]);
        break;
      case 'lct_sampledline':
        this.domainX = [0, this.dataCount-1];
        this.scale_x = d3.scale.linear().domain(this.domainX).range([0, this.width]);
        break;
      case 'lct_column':
        if (this.dataLabels) {
          this.domainX = d3.range(this.dataCount).map(function(i) {return this.dataLabels[i];}.bind(this));
        } else {
          this.domainX = d3.range(this.dataCount).map(function(i) {return i;});
        }
        this.scale_x = d3.scale.ordinal().domain(this.domainX).rangeRoundBands([0, this.width],0.1);
        break;
    }

    if (this.dataLabels) {
      this.axisX = d3.svg.axis().scale(this.scale_x).orient("bottom");
      this.axisXG = this.svgMainG.append("g").attr("class", "x d3axis").call(this.axisX);
      this._adjustAxisX();
    }
    this.height = dim.h - this.margin.top - this.margin.bottom;
    
    if (this.axisXG) {
      this.axisXG.attr("transform", "translate(0," + this.height + ")");
    }

    if (this.legendLabels) {
      this._paintLegend();
    }

    this.clipPath = this.svgMainG.append("defs").append("clipPath").attr("id", "clip");
    this.clipPathRect = this.clipPath.append("rect").attr("width", this.width).attr("height", this.height);

    this.scale_y = d3.scale.linear().domain([this.dataMin,this.dataMax]).range([this.height, 0]);
    this.axisY = d3.svg.axis().scale(this.scale_y).ticks(this.dataTickHint).orient("left");
    this.axisYG = this.svgMainG.append("g").attr("class", "y d3axis").call(this.axisY);

    this.start();
    this._events.push(dojo.connect(this,'resize',this.applyScale.bind(this)));
  },
  _adjustAxisX: function() {
    var addMargin = 0;
    function _adjustXAxisLabels(d) {
      var bcr = this.getBoundingClientRect();
      ySpace = bcr.bottom - bcr.top;
      if (ySpace>addMargin) {
        addMargin = ySpace;
      }
      return "rotate(-90) translate(-5,"+(bcr.left-bcr.right)+")"
    }
    
    this.axisXG.selectAll("text").style("text-anchor", "end").attr("transform", function(d) { return "rotate(-90)" }).attr("transform", _adjustXAxisLabels);
    this.margin.bottom = this.margin.bottom - this.axisXMargin + addMargin;
    this.axisXMargin = addMargin;
  },
  _paintLegend: function() {
    this.legendSize = 0;
    this.legend = this.svgMainG.append("g");
    for (var i=0; i<this.seriesCount; i++) {
      this.legendItems[i] = this.legend.append("g").attr("class", "legend");
      this.legendItems[i].append("rect").attr("x", this.legendSize).attr("y",-5).attr("width", 18).attr("height", 2).style("fill", '#' + this.seriesColor[i]);
      this.legendSize = this.legendSize + 25;
      var text = this.legendItems[i].append("text").attr("x", this.legendSize).text(this.legendLabels[i]);
      this.legendSize = this.legendSize + text[0][0].getBBox().width + 20;
    }
    this.legentSize = this.legendSize - 20;
    this.legend.attr("transform","translate("+((this.width / 2)-(this.legendSize / 2))+","+ (this.height + this.margin.top-10)+")");
  },
  _paintColumns: function() {
    for (var i=0; i<this.seriesCount; i++) {
      var rect = this.svgMainG.selectAll(".series"+this.id+'_'+i).data(this.data[i]);
          
      rect.enter().append("rect").attr("class", "series"+this.id+'_'+i);

      var y0 = (this.dataMin > 0) ? this.dataMin : 0;
      
      rect.attr("x",function(d, i) { return this.scale_x(this.domainX[i]); }.bind(this))
        .attr("width", this.scale_x.rangeBand())
        .attr("y",function(d, i) { return this.scale_y(d); }.bind(this))
        .attr("height",  function(d, i) { return (d<this.dataMin) ? 0 : this.scale_y(y0) - this.scale_y(d); }.bind(this));
            
      rect.exit().remove();
    }
  }
});

//Chart
dojo.declare("FIRMOS.Chart",dojox.charting.widget.Chart, {
  constructor: function(args) {
    this.store_ = args.store;
    this.type = args.type;
    this.seriesIds_ = args.seriesids;
    this.title = args.title;
    this.storeAdapters_ = [];
    if (args.labels) {
      this.labels_ = [];
      if (this.type == 'ct_column') {
        var offset = 1;
      } else {
        var offset = 0;
      }
      for (var i=0; i<args.labels.length; i++) {
        this.labels_[i] = {value: i+offset, text: args.labels[i]};
      }
    }
    G_UI_COM.registerStoreView(args.store.id,this);
  },
  destroy: function() {
    for (var i=0; i<this.storeAdapters_.length; i++) {
      this.storeAdapters_[i].destroy();
    }
    G_UI_COM.unregisterStoreView(this.store.id,this);
    this.inherited(arguments);
    if (this.firstRenderListener_) {
      this.firstRenderListener_.remove();
      this.firstRenderListener_ = null;
    }
  },
  _getValueFunc: function(object) {
    var ret = {};
    ret.y = object.value;
    if (object.color) {
      ret.color = object.color;
    }
    if (object.text) {
      ret.text = object.text;
    }
    if (object.legend) {
      ret.legend = object.legend;
    }
    return ret;
  },
  _addSeries: function() {
    this.chart.setTheme(dojox.charting.themes.Firmos);
    for (var i=0; i<this.seriesIds_.length; i++) {
      this.storeAdapters_.push(new FIRMOS.StoreSeries(this.store_, {query:{sId: this.seriesIds_[i]}}, this._getValueFunc, this.id));
      this.chart.addSeries(this.seriesIds_[i],this.storeAdapters_[this.storeAdapters_.length-1]);
    }
    var xProps = {};
    var yProps = {vertical: true};
    var plotProps = {markers: true
                    ,gap: 2
                    };
    switch (this.type) {
      case 'ct_pie':
        plotProps.type = 'Pie';
//        plotProps.htmlLabels=false;
        break;
/*      case 'ct_column':
        plotProps.type = 'ClusteredBars';
        if (this.labels_) {
          yProps.dropLabels = false;
          yProps.labels = this.labels_;
        }
        xProps.includeZero = true;
        xProps.rotation = 90;
        if (this.maxValue>0) {
          xProps.max = this.maxValue;
        }
        break; */
      case 'ct_column':
        plotProps.type = 'ClusteredColumns';
        if (this.labels_) {
          xProps.dropLabels = false;
          xProps.labels = this.labels_;
          xProps.rotation = 90;
        }
        //xProps.minorTicks = false;
        xProps.dropLabels = false;
//        xProps.htmlLabels = false;
//        yProps.htmlLabels = false;
        yProps.includeZero = true;
        if (this.maxValue>0) {
          yProps.max = this.maxValue;
        }
        break;
      case 'ct_line':
        plotProps.type = 'Lines'
        if (this.labels_) {
//          xProps.dropLabels = false;
          xProps.labels = this.labels_;
        }
        yProps.includeZero = true;
        break;
    }
    this.chart.addAxis('x', xProps);
    this.chart.addAxis('y', yProps );
    this.chart.title = this.title;
    this.chart.addPlot('default', plotProps);

    if (this.showlegend) {
      this.firstRenderListener_ = dojo.connect(this.chart,'render',this._showLegend.bind(this));
    }
  },
  _showLegend: function() {
    if (this.firstRenderListener_) {
      this.firstRenderListener_.remove();
      this.firstRenderListener_ = null;
    }
    this.getParent().getParent().getChildren()[1].content.refresh();
    this.getParent().getParent().layout();
  },
  buildRendering: function() {
    this.inherited(arguments);
    setTimeout(this._addSeries.bind(this), 0);
  }
});

//TopMenu
dojo.declare("FIRMOS.TopMenu", dijit.layout.BorderContainer, {
  notificationMinWidth: 0,
  notificationsClosed: false,
  notificationPanelId: '',
  constructor: function(params) {
    this._events = new Array();
  },
  _layoutChildren: function(childId,width,height) {
    this.inherited(arguments);
    if (this.notificationsClosed && (childId==this.notificationPanelId) && (width>0)) {
      this.notificationsClosed = false;
      dojo.style(this.openNotificationsButton, "display", "none");
      dojo.style(this.closeNotificationsButton, "display", "");
    }
  },
  destroy: function() {
    while (this._events.length>0) {
      this._events.pop().remove();
    }
  },
  postCreate: function() {
    this.inherited(arguments);
    var tMenu = new dijit.layout.ContentPane({region: 'top', splitter: false, class: 'firmosTransparent'});
    var content = '';
    content = content+'<div class="topMenu">';
    content = content + '<div class="topMenuLogoLeft"></div>';
    content = content + '<div class="topMenuLogoRight"></div>';
    if (this.notificationPanelId!='') {
      content = content + '<div class="topMenuNotificationToggleClose" id="topMenuNotificationToggleClose"></div>';
      content = content + '<div class="topMenuNotificationToggleOpen" id="topMenuNotificationToggleOpen" style="display:none;"></div>';
    }
    content = content+'<div class="buttonListWrapper">';
    
    var iconSize;
    var eventStr = '';
    var isBigStr;
    for (var i=0;i<this.entries.length; i++) {
      if (this.entries[i].isBig) {
        iconSize = '53';
        isBigStr = 'Big';
      } else {
        iconSize = '38';
        isBigStr = '';
      }
      G_UI_COM.createCSSRule('topMenu'+this.entries[i].entryId,'background: url('+this.entries[i].icon+'); background-repeat: no-repeat; background-size:'+iconSize+'px '+iconSize+'px; background-position: center;');
      content = content+'<div class="buttonListItem"><div id="topMenu'+this.entries[i].entryId+'" class="menuButton'+isBigStr+'">'
                       +'<div class="base"><div class="shineTop"><div class="buttonIcon topMenu'+this.entries[i].entryId+'"><div class="shineBottom"></div></div></div></div>'
                       +'<div class="captionContainer"><div class="buttonCaption">'+this.entries[i].caption+'</div></div>'
                       +'</div></div>';
    }
    content = content + '</div></div>';
    tMenu.set('content',content);
    this.addChild(tMenu);

    if (this.notificationPanelId!='') {
      var np = new dijit.layout.ContentPane({id: this.notificationPanelId, region: "right", content: "", class:"firmosNotificationPanel", splitter: true});
      this.addChild(np);
    }

    setTimeout(this._registerButtons.bind(this),0);
  },
  notificationToggle: function(open) {
    var np = dijit.byId(this.notificationPanelId);
    if (open) {
      this.notificationsClosed = false;
      dojo.style(this.openNotificationsButton, "display", "none");
      dojo.style(this.closeNotificationsButton, "display", "");
      np.resize({w: this.notificationStoreWidth});
      this.layout();
    } else {
      this.notificationsClosed = true;
      dojo.style(this.openNotificationsButton, "display", "");
      dojo.style(this.closeNotificationsButton, "display", "none");
      this.notificationStoreWidth = dojo.position(np.domNode).w;
      np.resize({w: this.notificationMinWidth});
      this.layout();
    }
  },
  _registerButtons: function() {
    this.layout();
    for (var i=0; i<this.entries.length; i++) {
      var node = dojo.byId('topMenu'+this.entries[i].entryId);
      this._events.push(dojo.connect(node,dojox.gesture.tap,this.onClickHandler.bind(this,i)));
    }
    if (this.notificationPanelId!='') {
      this.openNotificationsButton = dojo.byId('topMenuNotificationToggleOpen');
      this._events.push(dojo.connect(this.openNotificationsButton,dojox.gesture.tap,this.notificationToggle.bind(this,true)));
      this.closeNotificationsButton = dojo.byId('topMenuNotificationToggleClose');
      this._events.push(dojo.connect(this.closeNotificationsButton,dojox.gesture.tap,this.notificationToggle.bind(this,false)));
    }
  },
  onClickHandler: function(idx,evt) {
    if (this.entries[idx].isDialog) {
      if (this.entries[idx].isJira) {
        if (window._showCollectorDialog) {
          window._showCollectorDialog();
        } else {
          console.error('JIRA integration not included!');
        }
      } else {
        G_SERVER_COM.callServerFunction(this.entries[idx].class,this.entries[idx].func,this.entries[idx].uidpath,this.entries[idx].params);
      }
    } else {
      G_UI_COM.showSectionPath(this.subSecsId,[this.entries[idx].entryId],true);
    }
  }
});

//Sitemap
dojo.declare("FIRMOS.Sitemap", dijit.layout.BorderContainer, {
  constructor: function() {
    this._events = new Array();
    this.mainEntriesCP = null;
    this.detailsCP = null;
    this.mainEntriesContainer = null;
    this.mainEntriesSurface = null;
    this.mainEntriesGroupGFX = null;
    this.mainEntriesBB = null;
    this.mainEntriesMoveCtrl = false;
    this.mainEntriesMoveCtrlUpGFX = null;
    this.mainEntriesMoveCtrlDownGFX = null;
    this.mainEntriesPos = 0;
    this.detailsContainer = null;
    this.detailsSurface = null;
    this.detailsDim = null;
    this.detailsMinVisibleSection = 100;

    this.animationRunning = false;
    this.toggleAnimationDuration = 500;
    this.focusElementAnimationDuration = 250;
    this.minimizedScale = 0.05; //chrome and safari have problems with smaller scales
    this.levelScale = 0.6;
    this.moveFactor = 0.2;
    this.lastMove_ = (new Date()).getTime();
    this.moving_ = false;
    this.moveToClickTimeMin = 100;
    this.mouseWheelDivisor = 100;
    this.pinchDivisor = 5;
    G_UI_COM.registerSitemap(this);
  },
  destroy: function() {
    G_UI_COM.unregisterSitemap(this);
    while (this._events.length>0) {
      this._events.pop().remove();
    }
    this.inherited(arguments);
    if (this.mainEntriesMoveEndEvent) {
      this.mainEntriesMoveEndEvent.remove();
      this.mainEntriesMoveEndEvent = null;
    }
  },
  postCreate: function() {
    this.inherited(arguments);
    this.mainEntriesCP = new dijit.layout.ContentPane({region: 'left', splitter: false, class: 'firmosTransparent'});
    this.mainEntriesCP.set('content','<div id="'+this.id+'_me_gfx" style="width:100%; height:100%;"></div>');
    this.mainEntriesCP.set('style','width: 140px; overflow: hidden');
    
    this.detailsCP = new dijit.layout.ContentPane({region: 'center', splitter: false, class: 'firmosTransparent'});
    this.detailsCP.set('content','<div id="'+this.id+'_d_gfx" style="width:100%; height:100%;"></div>');
    this.detailsCP.set('style','width: 100%; overflow: hidden');
    this.addChild(this.mainEntriesCP);
    this.addChild(this.detailsCP);

    setTimeout(this.buildSitemap.bind(this),0);
  },
  buildSitemap: function() {
    var parent = this.getParent();
    var contentObj = this;
    while (parent) {
      if (parent.isInstanceOf(FIRMOS.TabContainer)) {
        contentObj._fixContent = true;
      }
      contentObj = parent;
      parent = contentObj.getParent();
    }

    this.mainEntriesContainer = dojo.byId(this.id+'_me_gfx');
    this.mainEntriesSurface = dojox.gfx.createSurface(this.id+'_me_gfx','100%','100%');
    
    this.detailsContainer = dojo.byId(this.id+'_d_gfx');
    this.detailsSurface = dojox.gfx.createSurface(this.id+'_d_gfx','100%','100%');

    this.buildSVGDefs();

    var collapsedState = false;
    for (var i=0; i<this.entries.length; i++) {
      if (this.entries[i].entries) {
        this.entries[i].collapsed = collapsedState;
        collapsedState = true;
      } else {
        this.entries[i].collapsed = true;
      }
    }

    if (this.entries.length == 1) {
      this.mainEntriesCP.set('style','display: none')
      this._fixEntriesDataType(this.entries[0]);
    } else {
      this.mainEntriesGroupGFX = this.mainEntriesSurface.createGroup();
      for (var i=0; i<this.entries.length; i++) {
        var elementGroup = this.mainEntriesGroupGFX.createGroup();
        this.entries[i].groupGFX = elementGroup;
        this.entries[i].x = 80;
        if (i==0) {
          this.entries[i].y = 30;
        } else {
          this.entries[i].y = this.entries[i-1].y + this.entries[i-1].height + 30;
        }
        this.createEntry(elementGroup,this.entries[i],false);
        if (!this.entries[i].collapsed) {
          this.entries[i].elementGFX.rawNode.childNodes[0].setAttribute('class','firmosSitemapEntryPressed');
          this.entries[i].elementGFX.rawNode.childNodes[1].setAttribute('class','firmosSitemapEntryPressed2');
        }
        this.createShortcut(this.entries[i]);
        //FIXXME - check needed space
      }
    }
    var path = [];
    this.detailsDim = dojo.position(this.detailsContainer);
    for (var i=0; i<this.entries.length;i ++) {
      this.entries[i].childrenGroupMoveGFX = this.detailsSurface.createGroup();
      this.entries[i].childrenGroupGFX = this.entries[i].childrenGroupMoveGFX.createGroup();
      this.entries[i].activeLevel = 1;
      this.entries[i].levelScale = 1;
      this.entries[i].maxLevel = 1;
      this.entries[i].maxLevelScale = 1;
      path[0] = i;
      if (this.entries[i].entries.length>0) {
        this.buildDetails(this.entries[i],path,null,this.entries[i].childrenGroupGFX);
        for (var j=1; j<this.entries[i].maxLevel; j++) {
          this.entries[i].maxLevelScale = this.entries[i].maxLevelScale / this.levelScale;
        }

        var bb = this.entries[i].childrenGroupGFX.getBoundingBox();
        this.entries[i].eventRect = this.entries[i].childrenGroupMoveGFX.createRect({ x:bb.x-this.detailsDim.w, y:bb.y-this.detailsDim.h, width:bb.width+2*this.detailsDim.w, height:bb.height+2*this.detailsDim.h}).setFill([0,0,0,0]).moveToBack();
        var gMA = dojox.gfx.Moveable(this.entries[i].childrenGroupMoveGFX);
        this._events.push(dojo.connect(gMA,'onMoveStop',this._moveActionStop.bind(this)));
        this._events.push(dojo.connect(gMA,'onMove',this._moveAction.bind(this)));
        this._events.push(dojo.connect(this.entries[i].eventRect.getEventSource(), dojox.gesture.tap.doubletap, this.resetDisplay.bind(this,this.entries[i])));
        this._events.push(dojo.connect(this.entries[i].eventRect.getEventSource(), 'gesturechange', this.gestureHandler.bind(this,this.entries[i])));

        var wheelEventName = dojo.isMozilla ? "DOMMouseScroll" : "onmousewheel";

        this._events.push(dojo.connect(this.entries[i].childrenGroupMoveGFX.getEventSource(), 'gesturechange', this.gestureHandler.bind(this,this.entries[i])));
        this._events.push(dojo.connect(this.entries[i].childrenGroupMoveGFX.getEventSource(), wheelEventName, this.gestureHandler.bind(this,this.entries[i])));
      } else {
        this.entries[i].path = dojo.clone(path);
      }
    }
    if (this.entries.length>1) {
      this.mainEntriesBB = this.mainEntriesGroupGFX.getBoundingBox();
    }
    this.resizeSVGHandler(); 
    this.layout();
    setTimeout(this._initialLayoutDetails.bind(this),0);
    this._events.push(dojo.connect(this,'resize',this.resizeSVGHandler.bind(this)));
  },
  gestureHandler: function(element, evt) {
    if (this.animationRunning) {
      setTimeout(this.gestureHandler.bind(this,element,evt),100);
      return;
    }
    
    if (evt.scale) {
      var scale = 1 + (evt.scale - 1) / this.pinchDivisor;
    } else {
      var scale = evt[(dojo.isMozilla ? "detail" : "wheelDelta")] * (dojo.isMozilla ? -1 : 1);
      scale = 1 + scale / this.mouseWheelDivisor;
    }
    var newScale = element.levelScale * scale;

    if (newScale<1) {
      newScale = 1;
      scale = newScale / element.levelScale;
    }
    if (newScale>element.maxLevelScale) {
      newScale = element.maxLevelScale;
      scale = newScale / element.levelScale;
    }
    
    var dim = dojo.position(this.domNode);
    element.levelScale = newScale;
    element.childrenGroupMoveGFX.applyLeftTransform(dojox.gfx.matrix.scaleAt(scale, (dim.w / 2) - this.detailsDim.x, dim.h / 2));
    
    var level = 2;
    var levelScale1 = 1;
    var levelScale2 = 1 / this.levelScale;
    while (levelScale2<newScale) {
      levelScale1 = levelScale2;
      levelScale2 = levelScale2 / this.levelScale;
      level = level + 1;
    }
    
    if ((newScale-levelScale1) < (levelScale2-newScale)) {
      level = level - 1;
    }
    
    var oLevel = element.activeLevel;
    element.activeLevel = level;
    this.highlightActiveLevel(element,oLevel);
  },
  _initialLayoutDetails: function() {
    for (var i=0; i<this.entries.length;i ++) {
      if (this.entries[i].entries.length>0) {
        this.layoutDetails(this.entries[i]);
      }
    }
  },
  _moveAction: function() {
    this.moving_ = true;
  },
  _moveActionStop: function() {
    if (this.moving_) {
      this.lastMove_ = (new Date()).getTime();
      this._checkDetailsVisibility();
    }
    this.moving_ = false;
  },
  _checkDetailsVisibility: function() {
    for (var i=0; i<this.entries.length; i++) {
      if (this.entries[i].collapsed==false) {
        var bb = this.entries[i].childrenGroupGFX.getTransformedBoundingBox();
        var left = this.detailsMinVisibleSection - bb[1].x;
        var right = this.detailsDim.w - this.detailsMinVisibleSection - bb[0].x;
        var up = this.detailsMinVisibleSection - bb[2].y;
        var down = this.detailsDim.h - this.detailsMinVisibleSection - bb[1].y;
        var move_it = false;
        if (left>0) move_it = true; else left = 0;
        if (right<0) move_it = true; else  right = 0;
        if (up>0) move_it = true; else up = 0;
        if (down<0) move_it = true; else down = 0;
        if (move_it) {
          this.entries[i].childrenGroupMoveGFX.applyTransform(dojox.gfx.matrix.translate(left+right, up+down));
        }
        break;
      }
    }
  },
  layoutDetails: function(element) {
    this._centerGFX(element.childrenGroupMoveGFX,element.entries[0].elementGFX);
    if (element.collapsed) {
      var cbb = element.childrenGroupMoveGFX.getTransformedBoundingBox();
      var bbdest = element.groupGFX.getTransformedBoundingBox();
      var mDim = dojo.position(this.mainEntriesContainer);
      bbdest[0].x = bbdest[0].x - mDim.w;
      bbdest[1].x = bbdest[1].x - mDim.w;

      element.childrenGroupMoveGFX.moveToBack();
      element.childrenGroupMoveGFX.applyTransform(dojox.gfx.matrix.translate(bbdest[0].x + (bbdest[1].x-bbdest[0].x) / 2 - cbb[0].x - (cbb[1].x-cbb[0].x) / 2, bbdest[1].y + (bbdest[2].y-bbdest[1].y) / 2 - cbb[1].y - (cbb[2].y-cbb[1].y) / 2));
      element.childrenGroupMoveGFX.applyLeftTransform(dojox.gfx.matrix.scaleAt(this.minimizedScale,bbdest[0].x + (bbdest[1].x-bbdest[0].x) / 2, bbdest[1].y + (bbdest[2].y-bbdest[1].y) / 2));
      element.childrenGroupMoveGFX.rawNode.style.display = 'none';
    }
  },
  buildDetails: function(element, path, bbParent, parentGFX) {
    element.path = dojo.clone(path);

    if (bbParent) {
      var pbb = element.elementGFX.getTransformedBoundingBox();

      var pXT = pbb[0].x + (pbb[1].x - pbb[0].x) / 2;
      var pYT = pbb[1].y + (pbb[2].y - pbb[1].y) / 2;
    }
    this.entries[path[0]].maxLevel = Math.max(this.entries[path[0]].maxLevel,path.length-1);

    for (var i=0; i<element.entries.length; i++) {
      var elementGroup = parentGFX.createGroup();
      element.entries[i].groupGFX = elementGroup;
      this.createEntry(elementGroup,element.entries[i],(element.path.length==1));
    
      var bb = element.entries[i].groupGFX.getTransformedBoundingBox();
      if (bbParent) {
        var cebbT=element.entries[i].elementGFX.getTransformedBoundingBox();
        var sourceEXT = cebbT[0].x + (cebbT[1].x - cebbT[0].x) / 2;
        var sourceEYT = cebbT[1].y + (cebbT[2].y - cebbT[1].y) / 2;

        var line = parentGFX.createRect({ x:0, y:0, width:0, height:0});
        element.entries[i].connector = line;
        line.rawNode.setAttribute('style','fill: url("/#connectorgradient"); fill-opacity: 1;');
        this.repaintConnector(line,sourceEXT,sourceEYT,pXT,pYT,5);
      }
      path.push(i);
      this.buildDetails(element.entries[i],path, bb, elementGroup);
      path.pop();
      if (bbParent) {
        var destX = (pXT - sourceEXT) * this.moveFactor;
        var destY = (pYT - sourceEYT) * this.moveFactor;

        element.entries[i].connector.applyLeftTransform(dojox.gfx.matrix.translate((pXT - sourceEXT)*this.moveFactor,(pYT - sourceEYT)*this.moveFactor));
        element.entries[i].connector.applyLeftTransform(dojox.gfx.matrix.scaleAt((1-this.moveFactor),sourceEXT + (pXT - sourceEXT)*this.moveFactor,sourceEYT + (pYT - sourceEYT)*this.moveFactor)); 

        element.entries[i].groupGFX.applyTransform(dojox.gfx.matrix.translate(destX, destY));
        element.entries[i].groupGFX.applyLeftTransform(dojox.gfx.matrix.scaleAt(this.levelScale,sourceEXT + destX, sourceEYT + destY));
      }
    }
  },
  repaintConnector: function(connector,x1,y1,x2,y2,size) {
    var xl = x2-x1;
    var yl = y2-y1;
    var rx = x1 + xl / 2;
    var ry = y1 + yl / 2;
    var length = Math.sqrt(xl*xl + yl*yl);
    var alpha = Math.asin(yl/length);
    if (x2<x1) {
      alpha=-alpha;
    }
    connector.setShape({ x:rx-length/2, y: ry-size / 2, width: length, height:size});
    connector.applyTransform(dojox.gfx.matrix.rotateAt(alpha,rx,ry)).moveToBack();
    connector._originalTrans = connector.getTransform();
  },
  _fixEntriesDataType: function(element) {
    if (element.entries) {
      if (!(element.entries instanceof Array)) {
        element.entries = [element.entries];
      }
    } else {
      element.entries = [];
    }
  },
  createEntry: function(parentElement,element,isActiveLevel) {
    this._fixEntriesDataType(element);
    var iconSize = 48;
    
    var group = parentElement.createGroup();
    element.elementGFX = group;
    element.width = 100;
    if (element.icon) {
      element.height = iconSize + 20 + 10;
    } else {
      element.height = 35;
    }
    var activeLevelExt = '';
    if (isActiveLevel) {
      activeLevelExt = 'AL';
    }
    var rect = group.createPath({path: "M117.084,49.496c0,1.105-0.941,2-2.103,2h-"+element.width+"c-1.161,0-2.103-0.895-2.103-2v-"+element.height+"c0-1.104,0.941-2,2.103-2h"+element.width+"c1.161,0,2.103,0.896,2.103,2V49.496z"});
    rect.applyTransform(dojox.gfx.matrix.translate(element.x-67.2,element.y));
    var rect2 = group.createPath({path: "M115.75,48.171c0,1.012-0.915,1.829-2.042,1.829h-"+(element.width-2.879)+"c-1.127,0-2.042-0.817-2.042-1.829v-"+(element.height-2.908)+"c0-1.009,0.915-1.829,2.042-1.829h"+(element.width-2.879)+"c1.127,0,2.042,0.82,2.042,1.829V48.171z"});
    rect2.applyTransform(dojox.gfx.matrix.translate(element.x-67.2,element.y));
    var rbb = rect.getTransformedBoundingBox();
    if (element.icon) {
      var icon = group.createImage({ x: rbb[0].x+(rbb[1].x-rbb[0].x)/2-iconSize/2, y: rbb[1].y+5, width: iconSize, height: iconSize, src: element.icon, preserveAspectRatio: 'meet'});
      var textY = rbb[1].y + iconSize + 20;
    } else {
      var textY = rbb[1].y+(rbb[2].y-rbb[1].y)/2+5;
    }
    var text = group.createText({ x: rbb[0].x+(rbb[1].x-rbb[0].x)/2, y: textY, text: element.caption, align: "center"}).setFont({ family: "Arial", size: "10pt" }).setFill("white");
    text.applyTransform(dojox.gfx.matrix.translate(-text.getTextWidth()/2,0));
    if (text.getTextWidth()>element.width-10) {
      var diff = text.getTextWidth() - element.width + 10;
      element.width = element.width + diff;
      rect.setShape({path: "M117.084,49.496c0,1.105-0.941,2-2.103,2h-"+element.width+"c-1.161,0-2.103-0.895-2.103-2v-"+element.height+"c0-1.104,0.941-2,2.103-2h"+element.width+"c1.161,0,2.103,0.896,2.103,2V49.496z"});
      rect2.setShape({path: "M115.75,48.171c0,1.012-0.915,1.829-2.042,1.829h-"+(element.width-2.879)+"c-1.127,0-2.042-0.817-2.042-1.829v-"+(element.height-2.908)+"c0-1.009,0.915-1.829,2.042-1.829h"+(element.width-2.879)+"c1.127,0,2.042,0.82,2.042,1.829V48.171z"});
      rect.applyTransform(dojox.gfx.matrix.translate(diff / 2,0));
      rect2.applyTransform(dojox.gfx.matrix.translate(diff / 2,0));
    }
    if (element.disabled) {
      rect.rawNode.setAttribute('class','firmosSitemapEntryDisabled'+activeLevelExt);
      rect2.rawNode.setAttribute('class','firmosSitemapEntryDisabled2');
    } else {
      rect.rawNode.setAttribute('class','firmosSitemapEntry'+activeLevelExt);
      rect2.rawNode.setAttribute('class','firmosSitemapEntry2');
    }
    var bb = group.getTransformedBoundingBox();
    var eventRect = group.createRect({ x: bb[0].x, y: bb[1].y, width: bb[1].x - bb[0].x, height: bb[2].y - bb[1].y }).setFill([0,0,0,0]);
    this._events.push(dojo.connect(group.getEventSource(),dojox.gesture.tap,this.elementOnClick.bind(this, element, false)));
    if (element.scale!=1) {
      var bb=group.getTransformedBoundingBox();
      group.applyLeftTransform(dojox.gfx.matrix.scaleAt(element.scale,bb[0].x+(bb[1].x-bb[0].x)/2, bb[1].y+(bb[2].y-bb[1].y)/2));
    }
    this.createInfoUI(element);
  },
  createInfoUI: function(element) {
    if (element.newscount>0) {
      if (element.infoGFX) {
        var moveY = 0;
        if (element.newscount > 99) {
          var size = 8;
          if (element.newscount_old<100) {
            moveY = -1;
          }
        } else {
          if (element.newscount_old>99) {
            moveY = 1;
          }
          var size = 10;
        }
        delete element.newscount_old;
        var text = element.infoGFX.children[2];
        var old_size = text.getTextWidth();
        text.setShape({ text: element.newscount + ''}).setFont({ size: size+"pt" });
        text.applyTransform(dojox.gfx.matrix.translate(old_size/2-text.getTextWidth()/2,moveY));
      } else {
        var bb=element.elementGFX.getBoundingBox();
        var info = element.groupGFX.createGroup();
        info.createCircle({cx: bb.x + bb.width, cy: bb.y, r: 12}).setFill('white');
        info.createCircle({cx: bb.x + bb.width, cy: bb.y, r: 10}).setFill('red');
        if (element.newscount > 99) {
          var size = 8;
        } else {
          var size = 10;
        }
        var text = info.createText({ x: bb.x + bb.width + 1, y: bb.y + size/2, text: element.newscount + ''}).setFont({ family: "Arial", size: size+"pt" }).setFill("white");
        text.applyTransform(dojox.gfx.matrix.translate(-text.getTextWidth()/2,0));
        if (element.scale!=1) {
          info.applyLeftTransform(dojox.gfx.matrix.scaleAt(element.scale,bb.x + bb.width, bb.y));
          info.applyTransform(dojox.gfx.matrix.translate(-bb.width*(1-element.scale)/2,bb.height*(1-element.scale)/2));
        }
        element.infoGFX = info;
      }
    } else {
      if (element.infoGFX) {
        element.infoGFX.destroy();
        delete element.infoGFX;
        delete element.newscount_old;
      }
    }
  },
  _isShortcutDisabled: function(element) {
    if (!element.entries) return true;
    for (var i=0; i<element.entries.length; i++) {
      if (!element.entries[i].disabled || this._isShortcutDisabled(element.entries[i])) {
        return false;
      }
    }
    return true;
  },
  createShortcut: function(element) {
    var disabled = element.disabled || this._isShortcutDisabled(element);
    if (disabled) {
      var style_str = 'firmosSMShortcutDisabled';
    } else {
      var style_str = 'firmosSMShortcutEnabled';
    }
    var bb=element.elementGFX.getBoundingBox();

    var sc = element.groupGFX.createGroup();
    var path=sc.createPath({path: "M19.158,32.64c-2.551,0-5.035-0.738-7.185-2.134c-2.961-1.922-4.995-4.882-5.729-8.334c-0.733-3.452-0.078-6.983,1.844-9.943c2.447-3.77,6.595-6.02,11.094-6.02c2.55,0,5.034,0.738,7.183,2.134c2.961,1.922,4.996,4.882,5.73,8.335c0.734,3.452,0.079,6.984-1.844,9.944C27.805,30.391,23.658,32.64,19.158,32.64z"});
    path.rawNode.setAttribute('class',style_str+'1');
    path=sc.createPath({path: "M19.184,5.709v1c2.453,0,4.842,0.71,6.91,2.053c2.849,1.85,4.807,4.698,5.513,8.02c0.706,3.321,0.076,6.72-1.774,9.568c-2.354,3.625-6.345,5.79-10.675,5.79c-2.454,0-4.844-0.71-6.913-2.053c-2.848-1.85-4.806-4.697-5.511-8.019c-0.706-3.321-0.076-6.719,1.774-9.567c2.354-3.626,6.345-5.792,10.674-5.792L19.184,5.709M19.183,5.709c-4.488,0-8.886,2.202-11.513,6.248C3.544,18.308,5.347,26.8,11.701,30.926c2.308,1.499,4.896,2.214,7.457,2.214c4.489,0,8.888-2.201,11.514-6.246c4.126-6.353,2.32-14.846-4.033-18.971C24.331,6.425,21.742,5.709,19.183,5.709L19.183,5.709z"});
    path.rawNode.setAttribute('class',style_str+'2');
    path=sc.createPath({path: "M0.2-20.001c-10.906,0-19.779,8.874-19.779,19.78c0,10.907,8.873,19.781,19.779,19.781c4.679,0,8.971-1.644,12.356-4.373l-9.806-8.48l25.828-3.813l-0.05,26.107l-9.07-7.845c-5.101,4.599-11.85,7.404-19.259,7.404c-15.894,0-28.779-12.887-28.779-28.781s12.886-28.78,28.779-28.78c12.468,0,23.081,7.928,27.08,19.016l-9.199,1.359C14.913-15.336,8.1-20.001,0.2-20.001z"});
    path.rawNode.setAttribute('class',style_str+'3');
    path.applyTransform({xx:-0.2177,yx:0.1947,xy:0.2037,yy:0.2278,dx:19.4619,dy:18.75});

    sc.applyTransform(dojox.gfx.matrix.translate(bb.x + bb.width - 25,bb.y + bb.height - 18));

    if (element.scale!=1) {
      sc.applyLeftTransform(dojox.gfx.matrix.scaleAt(element.scale,bb.x + bb.width, bb.y));
      sc.applyTransform(dojox.gfx.matrix.translate(-bb.width*(1-element.scale)/2,-bb.height*(1-element.scale)/2));
    }
    element.scGFX = sc; 
    
    if (!disabled) {
      this._events.push(dojo.connect(sc.getEventSource(),dojox.gesture.tap,this.elementOnClick.bind(this, element, true)));
    }
  },
  _getEntryByPath: function(path) {
    var notFound;
    var entry = this;
    while (path.length>0) {
      var id = path.shift();
      notFound = true;
      for (var i=0;i<entry.entries.length;i++) {
        if (id==entry.entries[i].id) {
          entry = entry.entries[i];
          notFound = false;
          break;
        }
      }
      if (notFound) {
        console.error('_getEntryByPath: Child ' + id + ' not found');
        return;
      }
    }
    return entry;
  },
  updateInfoUI: function(elementPath, info) {
    var entry = this._getEntryByPath(elementPath);
    entry.newscount_old = entry.newscount;
    entry.newscount = info;
    this.createInfoUI(entry);
  },
  _buildSVGDef: function(def) {
     var elem = dojo.doc.createElementNS('http://www.w3.org/2000/svg', def.tagname);
     if (def.attrs) {
       if (!(def.attrs instanceof Array)) {
         def.attrs = [def.attrs];
       }
       for (var i=0;i<def.attrs.length;i++) {
         elem.setAttribute(def.attrs[i].name,def.attrs[i].value);
       }
    }
     if (def.elems) {
       if (!(def.elems instanceof Array)) {
         def.elems = [def.elems];
       }
       for (var i=0;i<def.elems.length;i++) {
         var subelem = this._buildSVGDef(def.elems[i]);
         elem.appendChild(subelem);
       }
    }
    return elem;
  },
  buildSVGDefs: function() {
    var defsMain = this.mainEntriesSurface.rawNode.getElementsByTagName('defs')[0];
    var defsDetails = this.detailsSurface.rawNode.getElementsByTagName('defs')[0];
    for (var i=0;i<this.defs.length;i++) {
      var elem = this._buildSVGDef(this.defs[i]);
      defsMain.appendChild(elem);
      defsDetails.appendChild(elem);
    }
  },
  _createEventRects: function() {
    this.detailsDim = dojo.position(this.detailsContainer);
    for (var i=0; i<this.entries.length; i++) {
      if (this.entries[i].entries.length>0) {
        var bb = this.entries[i].childrenGroupGFX.getBoundingBox();
        this.entries[i].eventRect.setShape({ x:bb.x-this.detailsDim.w, y:bb.y-this.detailsDim.h, width:bb.width+2*this.detailsDim.w, height:bb.height+2*this.detailsDim.h});
      }
    }
    this._checkDetailsVisibility();
  },
  resizeSVGHandler: function() {
    if (this.entries.length>1) {
      this.mainEntriesCP.set('style','width: ' + (this.mainEntriesBB.x * 2 + this.mainEntriesBB.width-1) +'px; overflow: hidden;');
      setTimeout(function() {this.mainEntriesCP.set('style','width: ' + (this.mainEntriesBB.x * 2 + this.mainEntriesBB.width) +'px; overflow: hidden;')}.bind(this),0);
      this.mainEntriesContainerDim = dojo.position(this.mainEntriesContainer);
      if ((this.mainEntriesBB.y+this.mainEntriesBB.height)>this.mainEntriesContainerDim.h) {
        if (this.mainEntriesMoveCtrl) {
          var dy = this.mainEntriesBB.y + this.mainEntriesBB.height + this.mainEntriesPos - this.mainEntriesContainerDim.h;
          if (dy>0) {
            this._createMoveCtrlDown();
            this._repositionMoveCtrlDown();
          } else {
            this._removeMoveCtrlDown();
            this.mainEntriesGroupGFX.applyTransform(dojox.gfx.matrix.translate(0,-dy));
            this.mainEntriesPos = this.mainEntriesPos - dy;
          }
        } else {
          this.mainEntriesMoveCtrl = true;
          this._createMoveCtrlDown();
        }
      } else {
        if (this.mainEntriesMoveCtrl) {
          this._removeMoveCtrlDown();
          this._removeMoveCtrlUp();
          this.mainEntriesMoveCtrl = false;
          this.mainEntriesGroupGFX.applyTransform(dojox.gfx.matrix.translate(0,-this.mainEntriesPos));
          this.mainEntriesPos = 0;
        }
      }
    }
    setTimeout(this._createEventRects.bind(this),1);
  },
  _createMoveCtrlDown: function() {
    if (!this.mainEntriesMoveCtrlDownGFX) {
      this.mainEntriesMoveCtrlDownGFX = this.mainEntriesSurface.createGroup();
      this.mainEntriesMoveCtrlDownGFX.createRect({ x: 10, y: this.mainEntriesContainerDim.h - 30, width: this.mainEntriesContainerDim.w - 20, height: 30 }).setFill([0,0,0,0.5]);
      this.mainEntriesMoveCtrlDownGFX.createPolyline([{x: 15 , y: this.mainEntriesContainerDim.h - 25}, {x: this.mainEntriesContainerDim.w - 15, y: this.mainEntriesContainerDim.h - 25}, {x: this.mainEntriesContainerDim.w / 2 , y: this.mainEntriesContainerDim.h - 5}, {x: 15, y: this.mainEntriesContainerDim.h - 25}]).setFill("white");
      this._repositionMoveCtrlDown();
      this._events.push(dojo.connect(this.mainEntriesMoveCtrlDownGFX.getEventSource(),dojo.touch.press,this.mainEntriesMoveHandler.bind(this,-1)));
    }
  },
  _createMoveCtrlUp: function() {
    if (!this.mainEntriesMoveCtrlUpGFX) {
      this.mainEntriesMoveCtrlUpGFX = this.mainEntriesSurface.createGroup();
      this.mainEntriesMoveCtrlUpGFX.createRect({ x: 10, y: 0, width: this.mainEntriesContainerDim.w - 20, height: 30 }).setFill([0,0,0,0.5]);
      this.mainEntriesMoveCtrlUpGFX.createPolyline([{x: 15 , y: 25}, {x: this.mainEntriesContainerDim.w - 15, y: 25}, {x: this.mainEntriesContainerDim.w / 2 , y: 5}, {x: 15, y: 25}]).setFill("white");
      this._events.push(dojo.connect(this.mainEntriesMoveCtrlUpGFX.getEventSource(),dojo.touch.press,this.mainEntriesMoveHandler.bind(this,1)));
    }
  },
  _removeMoveCtrlUp: function() {
    if (this.mainEntriesMoveCtrlUpGFX) {
      this.mainEntriesMoveCtrlUpGFX.destroy();
      this.mainEntriesMoveCtrlUpGFX = null;
    }
  },
  _removeMoveCtrlDown: function() {
    if (this.mainEntriesMoveCtrlDownGFX) {
      this.mainEntriesMoveCtrlDownGFX.destroy();
      this.mainEntriesMoveCtrlDownGFX = null;
    }
  },
  _moveMainEntries: function(direction) {
    if (direction<0) {
      this._createMoveCtrlUp();
      if (this.mainEntriesBB.y + this.mainEntriesBB.height + this.mainEntriesPos <= this.mainEntriesContainerDim.h) {
        this._removeMoveCtrlDown();
        this.mainEntriesMoveEndHandler();
      }
    } else {
      this._createMoveCtrlDown();
      if (this.mainEntriesPos >= 0) {
        this._removeMoveCtrlUp();
        this.mainEntriesMoveEndHandler();
      }
    }
    if (this.mainEntriesMoveEndEvent) {
      this.mainEntriesGroupGFX.applyTransform(dojox.gfx.matrix.translate(0,direction));
      this.mainEntriesPos = this.mainEntriesPos + direction;
      setTimeout(this._moveMainEntries.bind(this,direction),10);
    }
  },
  mainEntriesMoveHandler: function(direction) {
    if (this.mainEntriesMoveEndEvent) {
      this.mainEntriesMoveEndHandler();
    }
    this.mainEntriesMoveEndEvent = dojo.connect(document,dojo.touch.release,this.mainEntriesMoveEndHandler.bind(this));
    this._moveMainEntries(direction);
  },
  mainEntriesMoveEndHandler: function(event) {
    if (this.mainEntriesMoveEndEvent) {
      this.mainEntriesMoveEndEvent.remove();
      this.mainEntriesMoveEndEvent = null;
    }
  },
  _repositionMoveCtrlDown: function() {
    if (this.mainEntriesMoveCtrlDownGFX) {
      var bb = this.mainEntriesMoveCtrlDownGFX.getTransformedBoundingBox();
      var dy = bb[2].y - this.mainEntriesContainerDim.h;
      if (dy!=0) {
        this.mainEntriesMoveCtrlDownGFX.applyTransform(dojox.gfx.matrix.translate(0,-dy));
      }
    }
  },
  _centerGFX: function(element,centerElement) {
    var dim = dojo.position(this.domNode);
    var vbb = centerElement.getTransformedBoundingBox();
    element.applyLeftTransform(dojox.gfx.matrix.translate((dim.w / 2) - this.detailsDim.x - ((vbb[1].x-vbb[0].x) / 2) - vbb[0].x, (dim.h / 2) - ((vbb[2].y-vbb[1].y) / 2) - vbb[1].y));
  },
  resetDisplay: function(element) {
    if (this.animationRunning) {
      return;
    }
    this.animationRunning = true;

    var animation = this._centerAndScale(element, element.levelScale);
    var oLevel = element.activeLevel;
    element.activeLevel = 1;
    element.levelScale = 1;
    this._events.push(dojo.connect(animation, "onEnd", this.highlightActiveLevel.bind(this,element,oLevel)));
    this._events.push(dojo.connect(animation, "onEnd", this.animationEnd.bind(this,element)));
  },
  _centerAndScale: function(element,actScale) {
    var dim = dojo.position(this.domNode);
    var bb = element.entries[0].elementGFX.getTransformedBoundingBox();

    var scale = 1 / actScale;

    var animation = new dojox.gfx.fx.animateTransform({
      duration: this.toggleAnimationDuration,
      shape: element.childrenGroupMoveGFX,
      transform: [{
        name: 'scaleAt',
        start: [1,bb[0].x + (bb[1].x-bb[0].x) / 2, bb[1].y + (bb[2].y-bb[1].y) / 2], 
        end: [scale, (dim.w / 2) - this.detailsDim.x, dim.h / 2]  
      },{
        name: 'translate',
        start: [0,0], 
        end: [(dim.w / 2) - this.detailsDim.x - bb[0].x - (bb[1].x-bb[0].x) / 2, dim.h / 2 - bb[1].y - (bb[2].y-bb[1].y) / 2]  
      },{ name: 'original' }]
    }).play();
    return animation;
  },
  elementToggleCollapse: function(element) {
    if (this.animationRunning) {
      return;
    }
    if (element.collapsed) {
      this.animationRunning = true;
      this._elementExpand(element,true);
    }
  },
  _elementExpand: function(element,addCallback) {
    var bb = element.childrenGroupMoveGFX.getTransformedBoundingBox();

    for (var i=0; i<this.entries.length; i++) {
      if (!this.entries[i].collapsed) {
        this._elementCollapse(this.entries[i],false);
      }
    }
    
    element.childrenGroupMoveGFX.rawNode.style.display = '';
    
    var animation=this._centerAndScale(element,this.minimizedScale);

    element.collapsed = false;
    if (addCallback) {
      this._events.push(dojo.connect(animation, "onEnd", this.animationEnd.bind(this,element)));
      this._events.push(dojo.connect(animation, "onEnd", this.expandElementEnd.bind(this,element)));
    }
  },
  _elementCollapse: function(element,addCallback) {
    var bb = element.childrenGroupMoveGFX.getTransformedBoundingBox();
    var bbdest = element.groupGFX.getTransformedBoundingBox();
    var mDim = dojo.position(this.mainEntriesContainer);
    bbdest[0].x = bbdest[0].x - mDim.w;
    bbdest[1].x = bbdest[1].x - mDim.w;

    var animation = new dojox.gfx.fx.animateTransform({
      duration: this.toggleAnimationDuration,
      shape: element.childrenGroupMoveGFX,
      transform: [{
        name: 'scaleAt',
        start: [1,bb[0].x + (bb[1].x-bb[0].x) / 2, bb[1].y + (bb[2].y-bb[1].y) / 2], 
        end: [this.minimizedScale,bbdest[0].x + (bbdest[1].x-bbdest[0].x) / 2, bbdest[1].y + (bbdest[2].y-bbdest[1].y) / 2]  
      },{
        name: 'translate',
        start: [0,0], 
        end: [bbdest[0].x + (bbdest[1].x-bbdest[0].x) / 2 - bb[0].x - (bb[1].x-bb[0].x) / 2, bbdest[1].y + (bbdest[2].y-bbdest[1].y) / 2 - bb[1].y - (bb[2].y-bb[1].y) / 2]  
      },{ name: 'original' }]
    }).play();
    element.collapsed = true;
    this._events.push(dojo.connect(animation, "onEnd", this.collapseElementEnd.bind(this,element)));

    if (addCallback) {
      this._events.push(dojo.connect(animation, "onEnd", this.animationEnd.bind(this,element)));
    }
  },
  animationEnd: function(element) {
    this.animationRunning = false;
  },
  collapseElementEnd: function(element) {
    element.elementGFX.rawNode.childNodes[0].setAttribute('class','firmosSitemapEntry');
    element.elementGFX.rawNode.childNodes[1].setAttribute('class','firmosSitemapEntry2');
  },
  expandElementEnd: function(element) {
    element.elementGFX.rawNode.childNodes[0].setAttribute('class','firmosSitemapEntryPressed');
    element.elementGFX.rawNode.childNodes[1].setAttribute('class','firmosSitemapEntryPressed2');
  },
  _highlightALRecursive: function(element, elementLevel, activeLevel, oldActiveLevel) {
    if ((elementLevel<activeLevel) || (elementLevel<oldActiveLevel)) {
      for (var i=0; i<element.entries.length; i++) {
        this._highlightALRecursive(element.entries[i],elementLevel+1,activeLevel,oldActiveLevel);
      }
    }
    if (elementLevel==activeLevel) {
      if (element.disabled) {
        element.elementGFX.rawNode.childNodes[0].setAttribute('class','firmosSitemapEntryDisabledAL');
      } else {
        element.elementGFX.rawNode.childNodes[0].setAttribute('class','firmosSitemapEntryAL');
      }
    }
    if (elementLevel==oldActiveLevel) {
      if (element.disabled) {
        element.elementGFX.rawNode.childNodes[0].setAttribute('class','firmosSitemapEntryDisabled');
      } else {
        element.elementGFX.rawNode.childNodes[0].setAttribute('class','firmosSitemapEntry');
      }
    }
  },
  highlightActiveLevel: function(rootElement, oldActiveLevel) {
    if (rootElement.activeLevel!=oldActiveLevel) {
      this._highlightALRecursive(rootElement, 0, rootElement.activeLevel, oldActiveLevel);
    }
  },
  elementOnClick: function(element, isShortcut, evt) {
    if ((this.moving_) || (((new Date()).getTime()-this.lastMove_)<this.moveToClickTimeMin)) return;
    evt.preventDefault();
    dojo.stopEvent(evt);
    if ((element.path.length==1) && !isShortcut) {
      this.elementToggleCollapse(element);
      return;
    }
    var jumpToSelection = true;
    if (element.path.length>1) {
      var mElement = this.entries[element.path[0]];
      var scale = 1;
      var nLevel = element.path.length - 1;
      var oLevel = mElement.activeLevel;
      if (oLevel != nLevel) {
        jumpToSelection = false;
        if (this.animationRunning) {
          setTimeout(this.elementOnClick.bind(this,element,isShortcut,evt),100);
          return;
        }
        this.animationRunning = true;

        if (mElement.activeLevel < nLevel) {
          for (var i=mElement.activeLevel; i<nLevel; i++) {
            scale = scale / this.levelScale;
          }
        } else {
          for (var i=mElement.activeLevel; i>nLevel; i--) {
            scale = scale * this.levelScale;
          }
        }
        mElement.activeLevel = nLevel;

        var newScale = mElement.levelScale * scale;
        if (newScale<1) {
          newScale = 1;
          scale = newScale / mElement.levelScale;
        }
        if (newScale>mElement.maxLevelScale) {
          newScale = mElement.maxLevelScale;
          scale = newScale / mElement.levelScale;
        }
        mElement.levelScale = newScale;

        var bb = element.elementGFX.getTransformedBoundingBox();

        var transform = mElement.childrenGroupMoveGFX.getTransform();
        
        var centerX = bb[0].x+(bb[1].x-bb[0].x)/2;
        var centerY = bb[1].y+(bb[2].y-bb[1].y)/2;
        var scaleAt = dojox.gfx.matrix.scaleAt(scale, centerX, centerY);

        if (evt.clientX && evt.clientY) {
          var mouseX = evt.clientX - this.detailsDim.x;
          var mouseY = evt.clientY - this.detailsDim.y;
        } else {
          var mouseX = centerX;
          var mouseY = centerY;
        }
        var move = dojox.gfx.matrix.translate(mouseX-centerX , mouseY-centerY );
        
        var animation = new dojox.gfx.fx.animateTransform({
          duration: this.focusElementAnimationDuration,
          shape: mElement.childrenGroupMoveGFX,
          transform: [{
            name: 'matrix',
            start: transform, 
            end: dojox.gfx.matrix.multiply(move,scaleAt,transform)
          }]
        }).play();
        this._events.push(dojo.connect(animation, "onEnd", this.animationEnd.bind(this,element)));
        this._events.push(dojo.connect(animation, "onEnd", this.highlightActiveLevel.bind(this,mElement,oLevel)));
      }
    }
    if (jumpToSelection) {
      if (element.disabled) return;
      if (!(element.sectionpath.sectionids instanceof Array)) {
        var path = [element.sectionpath.sectionids];
      } else {
        var path = dojo.clone(element.sectionpath.sectionids);
      }
      G_UI_COM.showSectionPathInProgress = true;
      if (!G_UI_COM.showSectionPath(element.sectionpath.basecontainerid, path, false)) {
        console.error('Could not resolve given section path: ' + JSON.stringify(element.sectionpath));
      }
    }
  }
});

//gridPBColumn
dojo.declare("FIRMOS.gridPBColumn", null, {
  constructor: function(args) {
    for (var i in args) {
      this[i] = args[i];
    }
  },
  renderCell: function(object, value, cell, options, header) {
    var pb = new dijit.ProgressBar({style: "width: 100%"});
    pb.set("value",value / this.maxValue * 100);
    if (this.labelId) { 
      pb.set('label',object[this.labelId]+'');
    }
    return pb.domNode;
  }
});

//gridDetailsColumn
dojo.declare("FIRMOS.gridDetailsColumn", null, {
  constructor: function() {
    this.label = '';
    this.className = 'dgrid-details';
    this.unhidable = true;
    this._events = new Array();
    return this;
  },
  destroy: function() {
    while (this._events.length>0) {
      this._events.pop().remove();
    }
  },
  renderCell: function(object, value, cell, options, header) {
    var div = dojo.create('div');
    if (this.grid.detailsClassname || (object._detailsfunc_ && object._funcclassname_)) {
      div.className = 'dgrid-details-closed';
      div.innerHTML = '+';
      var row = object && this.grid.row(object);
      row._detailsOpen = false;
      this._events.push(dojo.connect(div, "onclick", this.toggleDetails.bind(this,div,row)));
    } else {
      div.className = 'dgrid-details-none';
    }
    return div;
  },
  toggleDetails: function(div,row) {
    if (row._detailsOpen) {
      div.className = 'dgrid-details-closed';
      div.innerHTML = '+';
      this.grid.hideDetails(row);
    } else {
      div.className = 'dgrid-details-open';
      div.innerHTML = '-';
      this.grid.showDetails(row);
    }
    row._detailsOpen = !row._detailsOpen;
  },
  renderHeaderCell: function(th){
    return '';
  }
});

dojo.declare("FIRMOS.OnDemandGrid", [dgrid.OnDemandGrid,FIRMOS.GridBase,FIRMOS.Selection,FIRMOS.GridFilter,dgrid.ColumnResizer,FIRMOS.ColumnReorder,dgrid.ColumnHider,FIRMOS.GridDnD,dgrid.DijitRegistry]);

//SVG
dojo.declare("FIRMOS.SVG", dijit.layout.ContentPane, {
  postCreate: function() {
    this.inherited(arguments);
    this.set('content',this.svg);
    this.set('class', 'firmosSVGPanel');
    var children = this.containerNode.children;
    if (children.length>0) {
      this.svgNode = children[0];
      this.svgNode.setAttribute('width','100%');
      this.svgNode.setAttribute('height','100%');
    }
  },
  updateElement: function(elementId, attribute, value) {
    var element = dojo.byId(elementId, this.svgNode);
    if (element) {
      element.setAttribute(attribute,value);
    }
  }
});

//Editor
dojo.declare("FIRMOS.Editor", dijit.layout.BorderContainer, {
  texts: G_TEXTS.editor,
  _editorStarted: false,
  _savedContent: '',
  constructor: function(args) {
    switch (args.contentType) {
      case 'ct_html': 
        this.editorType = 'aloha';
        this.startEditAHandler = this.startEditA.bind(this);
        this.pauseEditAHandler = this.pauseEditA.bind(this);
        break;
      case 'ct_javascript':
      case 'ct_pascal':
        this.editorType = 'codemirror';
        this.startEditCMHandler = this.startEditCM.bind(this);
        this.pauseEditCMHandler = this.pauseEditCM.bind(this);
        break;
      default:
        console.error('Unknown content type ' + args.contentType);
        break;
    }
    if (args.saveClass) {
      this.readOnly = false;
    } else {
      this.readOnly = true;
    }
  },
  destroy: function() {
    switch (this.editorType) {
      case 'aloha':
        $(Aloha, 'body').unbind('aloha-editable-activated',this.startEditAHandler);
        $(Aloha, 'body').unbind('aloha-editable-deactivated',this.pauseEditAHandler);
        break; 
      case 'codemirror':
        this.cm.off('focus',this.startEditCMHandler);
        this.cm.off('blur',this.pauseEditCMHandler);
        break;
    }
    if (this.editableContent) {
      this.editableContent.destroy();
    }
    this.inherited(arguments);
  },
  postCreate: function() {
    this.inherited(arguments);
    this.editorCP = new dijit.layout.ContentPane({region: 'center', splitter: false});
    this.editorCP.set('content','<div id="'+this.id+'_container" style="width:100%; height:100%; background-color:#fff; overflow-y:auto;" class="article"></div>');
    if (this.tbBottom) {
      this.toolbar=new dijit.Toolbar({region: "bottom"});
      var button_style = '';
    } else {
      this.toolbar=new dijit.Toolbar({region: "top"});
      var button_style = 'float:right;';
    }
    this.saveButton=new dijit.form.Button({label:this.texts.saveButton
                                          ,disabled:true
                                          ,onClick:this.save.bind(this)
                                          ,style: button_style});
    this.toolbar.addChild(this.saveButton);
    this.resetButton=new dijit.form.Button({label:this.texts.resetButton
                                           ,disabled: true
                                           ,onClick:this.load.bind(this)
                                           ,style: button_style});
    this.toolbar.addChild(this.resetButton);

    this.addChild(this.toolbar);
    this.addChild(this.editorCP);
    
    setTimeout(this.startEditor.bind(this),0);
  },
  startEditor: function() {
    if (this.readOnly) {
      this.readOnlyContent = dojo.byId(this.id+'_container');
      dojo.addClass(this.readOnlyContent,"aloha-editable"); //FIXXME - handle codemirrot
    } else {
      switch (this.editorType) {
        case 'aloha':
          $('#'+this.id+'_container').aloha();
          this.editableContent = Aloha.getEditableById(this.id+'_container');
          Aloha.bind('aloha-editable-activated',this.startEditAHandler);
          Aloha.bind('aloha-editable-deactivated',this.pauseEditAHandler);
          break;
        case 'codemirror':
          this.cm = CodeMirror(dojo.byId(this.id+'_container'), {
            lineNumbers: true,
            mode:  this.contentType.substring(3)
          });
          this.cm.on('focus',this.startEditCMHandler);  // 'beforeChange' event?
          this.cm.on('blur',this.pauseEditCMHandler);
          break;
        default:
          return;
          break;
      }
    }
    this.load();
  },
  loadCallback: function(options, success, response, uiState) {
    if (success) {
      if (response.output!="") {
        var json_result = dojo.fromJson(response.output);
        this._savedContent = json_result.value;
        this.setValue(json_result.value);
      }
    }
  },
  getValue: function() {
    switch (this.editorType) {
      case 'aloha': return this.editableContent.getContents();
      case 'codemirror': return this.cm.getValue();
    }
  },
  setValue: function(newValue) {
    if (this.readOnly) {
      this.readOnlyContent.innerHTML = newValue;
    } else {
      switch (this.editorType) {
        case 'aloha':
          if (this.editableContent) {
            this.editableContent.setContents(newValue);
          }
          break;
        case 'codemirror':
          this.cm.setValue(newValue);
          break;
      }
    }
  },
  startEdit: function() {
    if (this._editorStarted) return;
    this.saveButton.set('disabled',false);
    this.resetButton.set('disabled',false);
    if (this.startEditClass) {
      G_SERVER_COM.callServerFunction(this.startEditClass, this.startEditFunc, this.startEditUidPath, this.startEditParams);
    }
    this._editorStarted = true;
  },
  pauseEdit: function() {
    if (!this._editorStarted) return;
    if (this.getValue() == this._savedContent) {
      this.stopEdit();
    }
  },
  startEditCM: function(cm) {
    this.startEdit();
  },
  pauseEditCM: function(cm) {
    this.pauseEdit();
  },
  startEditA: function(evt,params) {
    if (params.editable.getId()!=this.id+'_container') return;
    this.startEdit();
  },
  pauseEditA: function(evt,params) {
    if (params.editable.getId()!=this.id+'_container') return;
    this.pauseEdit();
  },
  stopEdit: function() {
    if (!this._editorStarted) return;
    if (this.stopEditClass) {
      G_SERVER_COM.callServerFunction(this.stopEditClass, this.stopEditFunc, this.stopEditUidPath, this.stopEditParams);
    }
    this.saveButton.set('disabled',true);
    this.resetButton.set('disabled',true);
    this._editorStarted = false;
  },
  save: function() {
    this.stopEdit();
    var params = dojo.clone
    var params = dojo.clone(this.saveParams);
    params.content = this.getValue();
    this._savedContent = params.content;
    G_SERVER_COM.callServerFunction(this.saveClass, this.saveFunc, this.saveUidPath, params);
  },
  load: function() {
    this.stopEdit();
    G_SERVER_COM.callServerFunction(this.loadClass, this.loadFunc, this.loadUidPath, this.loadParams, this.loadCallback.bind(this));
  }
});

//Shell
dojo.declare("FIRMOS.Shell", dijit.layout.ContentPane, {
  postCreate: function() {
    this.set('content','<iframe id="'+this.id+'_frame" src="'+this.protocol+'://'+this.host+':'+this.port+this.path+'" style="width:100%; height:100%;">Iframe not supported.</iframe>');
    this.set('style','overflow: hidden;');
    this.inherited(arguments);
  }
});

//VNC
dojo.declare("FIRMOS.VNC", dijit.layout.BorderContainer, {
  texts: G_TEXTS.vnc,
  constructor: function(args) {
    this.ws = null;
    this.state = 'disconnected';
    this.canvas = null;
    this.container = null;
    this.securityType = 0;
    this.serverSettings = {};
    this.context = null;
    this.tileImage = null;
    this.mouseButtonState = 0;
    this.mouseCoords = null;
    this.intervalId = null;
    this.scale = 1;
    this.isActive = false;
    this._events = new Array();
  },
  destroy: function() {
    this.disconnect();
    this.inherited(arguments);
  },
  postCreate: function() {
    this.vncCP = new dijit.layout.ContentPane({region: 'center', splitter: false});
    this.vncCP.set('content','<div id="'+this.id+'_container" style="width:100%; height:100%;"><canvas  class="firmosVNCInactive" tabindex="0" id="'+this.id+'_vnc" style="width:0px; height:0px; cursor: none;">Canvas not supported.</canvas></div>');
    this.vncCP.set('style','overflow: hidden;');
    this.toolbar=new dijit.Toolbar({region: "top"})
    this.cadButton=new dijit.form.Button({label:this.texts.cadButton
                                          ,onClick:this.sendCAD.bind(this)});
    this.toolbar.addChild(this.cadButton);
    this.wakeUpButton=new dijit.form.Button({label:this.texts.wakeUpButton
                                           ,disabled: true
                                           ,onClick:this.wakeUp.bind(this)});
    this.toolbar.addChild(this.wakeUpButton);
    this.mountButton=new dijit.form.Button({label:this.texts.mountButton
                                           ,disabled: true
                                           ,onClick:this.mountISO.bind(this)});
    this.toolbar.addChild(this.mountButton);

    this.addChild(this.toolbar);
    this.addChild(this.vncCP);
    
    this.inherited(arguments);
    setTimeout(this.connect.bind(this),0);
  },
  sendCAD: function() {
    //Down
    this.ws.send(new Uint8Array([4,1,0,0,0,0,255,227]).buffer); // Control FFE3
    this.ws.send(new Uint8Array([4,1,0,0,0,0,255,233]).buffer); // Alt FFE9
    this.ws.send(new Uint8Array([4,1,0,0,0,0,255,255]).buffer); // Alt FFFF
    //Up
    this.ws.send(new Uint8Array([4,0,0,0,0,0,255,227]).buffer); // Control FFE3
    this.ws.send(new Uint8Array([4,0,0,0,0,0,255,233]).buffer); // Alt FFE9
    this.ws.send(new Uint8Array([4,0,0,0,0,0,255,255]).buffer); // Alt FFFF
  },
  wakeUp: function() {
    
  },
  mountISO: function() {

  },
  stopEvent: function(evt) {
    dojo.stopEvent(evt);
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  },
  visibilityChange: function(visible) {
    if (visible) {
      this.connect();
    } else {
      this.disconnect();
    }
  },
  disconnect: function() {
    if (this.state=='disconnected') {
      return;
    }
    this.canvas.style.width = '0px';
    this.canvas.style.height = '0px';
    while (this._events.length>0) {
      dojo.disconnect(this._events.pop());
    }
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onerror = null;
    this.ws.close();
    this.ws = null;
    this.state = 'disconnected';
  },
  connect: function() {
    this.state = 'connecting';
    if ("https:" == document.location.protocol) {
      var protocol_prefix = 'wss://';
    } else {
      var protocol_prefix = 'ws://';
    }
    this.ws = new WebSocket(protocol_prefix+window.location.hostname+':'+window.location.port+'/FirmOS_FRE_WS','FirmOS-VC|'+this.host+'|'+this.port);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = this.wsOpenListener.bind(this);
    this.ws.onmessage = this.wsMessageListener.bind(this);
    this.ws.onerror = this.wsErrorListener.bind(this);
    this.canvas = dojo.byId(this.id+'_vnc');
    this.container = dojo.byId(this.id+'_container');
    this.context = this.canvas.getContext('2d');

    this._events.push(dojo.connect(this.canvas,'onmousemove',this.mouseMoveListener.bind(this)));
    this._events.push(dojo.connect(this.canvas,'onmousedown', this.mouseDownListener.bind(this)));
    this._events.push(dojo.connect(this.canvas,'onmouseup', this.mouseUpListener.bind(this)));
    this._events.push(dojo.connect(this.canvas,'onclick', this.mouseClickListener.bind(this)));
    this._events.push(dojo.connect(this.canvas,'oncontextmenu', this.contextMenuListener.bind(this)));

    this._events.push(dojo.connect(this.canvas,'onmouseenter',this.mouseEnter.bind(this)));
    this._events.push(dojo.connect(this.canvas,'onmouseout',this.mouseOut.bind(this)));

    this._events.push(dojo.connect(this.canvas, 'onkeydown', this.keyDownListener.bind(this)));
    this._events.push(dojo.connect(this.canvas, 'onkeyup', this.keyUpListener.bind(this)));
    this._events.push(dojo.connect(this.canvas, 'onkeypress', this.keyPressListener.bind(this)));

    this._events.push(dojo.connect(this,'resize',this.applyScale.bind(this)));

    if (this.intervalId) {
      window.clearInterval(this.intervalId);
    }
    this.intervalId = window.setInterval(this.sendMouseCoords.bind(this), 40);
    this.ws.onclose = this.wsCloseListener.bind(this);
  },
  
  decodeMessage2String: function(message) {
    var ba = new Uint8Array(message);
    var str='';
    for (var i=0; i<ba.length;i++) {
      str+=String.fromCharCode(ba[i]);
    }
    return str;
  },
  
  encodeString2Message: function(str) {
   var barr = new Uint8Array(str.length);
   for (var i = 0; i < str.length; i++) {
     barr[i] = str.charCodeAt(i);
   }
   return barr.buffer;
  },
  
  byteArray2String: function(ba,startIdx,endIdx) {
    var start = startIdx || 0;
    var end = endIdx || ba.length;
    var str='';
    for (var i=start; i<end; i++) {
      str+=String.fromCharCode(ba[i]);
    }
    return str;
  },
  
  applyScale: function() {
    var dim = dojo.position(this.container);
    dim.w = dim.w - 2;
    dim.h = dim.h - 2;
    if ((dim.w<this.serverSettings.width) || (dim.h<this.serverSettings.height)) {
      var ratioS = this.serverSettings.width / this.serverSettings.height;
      var ratioC = dim.w / dim.h;
      if (ratioS>ratioC) {
        this.scale = dim.w / this.serverSettings.width;
      } else {
        this.scale = dim.h / this.serverSettings.height;
      }
    }
    this.canvas.style.width = Math.floor(this.serverSettings.width * this.scale) + 'px';
    this.canvas.style.height = Math.floor(this.serverSettings.height * this.scale) + 'px';
  },
  
  wsMessageListener: function(message) {
    switch (this.state) {
      case 'init':
        var version = this.decodeMessage2String(message.data);
        switch (version) {
          case 'RFB 003.008\n':
            this.vncVersion = 3.8;
            this.state = 'security';
            this.ws.send(this.encodeString2Message(version));
            break;
          default:
            console.error('Version "' + version + '" not supported');
            this.ws.close();
            break;
        } 
        break;
      case 'security':
        var securityTypes = new Uint8Array(message.data);
        if (securityTypes[0]==0) {
          console.error('Got no valid security type');
          this.ws.close();
        }
        for (var i=0;i<securityTypes[0];i++) {
          if (securityTypes[i]==1) {
            this.securityType = securityTypes[i];
          }
        }
        switch (this.securityType) {
          case 0:
            console.error('Got no valid security type');
            this.ws.close();
            break;
          case 1:
            this.state='securityResult';
            this.ws.send(new Uint8Array([this.securityType]).buffer);
            break;
            //no authentication
          case 2:
            //vnc authentication
            console.error('VNC Authentication not supported');
            this.ws.close();
            break;
        }
        break;
      case 'securityResult':
        var result = new Uint8Array(message.data);
        if ((result[0] || result[1] || result[2] || result[3])!=0) {
          console.error('Security handshake failed');
          this.ws.close();
        } else {
          this.state = 'serverInit';
          this.ws.send(new Uint8Array([1]).buffer);  //try to share the desktop
        }
        break;
      case 'serverInit':
        var serverInit = new Uint8Array(message.data);
        this.serverSettings.width = serverInit[0]*256+serverInit[1];
        this.serverSettings.height = serverInit[2]*256+serverInit[3];
        this.applyScale();
        this.serverSettings.bitPerPixel = serverInit[4];
        if (this.serverSettings.bitPerPixel != 32) {
          console.error('Only True Color supported');
        }
        this.serverSettings.depth = serverInit[5];
        this.serverSettings.bigEndianFlag = serverInit[6];
        this.serverSettings.trueColorFlag = serverInit[7];
        this.serverSettings.redMax = serverInit[8]*256+serverInit[9];
        this.serverSettings.greenMax = serverInit[10]*256+serverInit[11];
        this.serverSettings.blueMax = serverInit[12]*256+serverInit[13];
        this.serverSettings.redShift = serverInit[14];
        this.serverSettings.greenShift = serverInit[15];
        this.serverSettings.blueShift = serverInit[16];
        this.serverSettings.name = this.byteArray2String(serverInit,24+((serverInit[20]*256+serverInit[21])*256+serverInit[22])*256+serverInit[23]);
        this.state = 'connected';
        this.tileImage = this.context.createImageData(16, 16);
        this.canvas.width = this.serverSettings.width;
        this.canvas.height = this.serverSettings.height;


        this.ws.send(new Uint8Array([0,0,0,0,32,24,0,1,0,255,0,255,0,255,16,8,0,0,0,0]).buffer); //pixelFormat
        this.ws.send(new Uint8Array([2,0
                                    ,0,3 //num encodings
                                    ,0,0,0,1 //COPYRECT
                                    ,0,0,0,5 //HEXTILE
//                                    ,255,255,254,252 //TIGHT_PNG
//                                    ,0,0,0,2 //RRE
                                    ,0,0,0,0 //RAW
//                                    ,255,255,255,33 //DesktopSize
//                                    ,255,255,255,17 //Cursor
//                                    ,255,255,255,224 //JPEG_quality_lo
//                                    ,255,255,255,1  //compress_lo
                                    ]).buffer); //
        this.ws.send(new Uint8Array([3,0,0,0,0,0,serverInit[0],serverInit[1],serverInit[2],serverInit[3]]).buffer); //pixelFormat
        break;
      case 'connected':
        var data = new Uint8Array(message.data);
        switch (data[0]) {
          case 0: //framebuffer update
            var rects = data[2] * 256 + data[3];
            if (rects == 0) {
//              console.log('ZERO RECTS - DO NOTHING');
              break;
            }
            var idx=4;
            for (var i=0;i<rects;i++) {
              var x = data[idx]*256+data[idx+1];
              var y = data[idx+2]*256+data[idx+3];
              var width = data[idx+4]*256+data[idx+5];
              var height = data[idx+6]*256+data[idx+7];
              idx+=8;
              var enc = data[idx+3];
              idx+=4;                            
              switch (enc) {
                case 0:
                  idx = this.handleRaw(data,x,y,width,height,idx);
                  break;
                case 1:
                  idx = this.handleCopyrect(data,x,y,width,height,idx);
                  break;
                case 5:
                  idx = this.handleHextile(data,x,y,width,height,idx);
                  break;
                case 252:
                  idx = this.handleTightPng(data,x,y,width,height,idx);
                  break;
                default:
                  console.error('Unknown Encoding ' + data[12] + '-' + data[13] + '-' + data[14] + '-' + data[15]);
              }
            }
            break;
          default:
            console.warn('Unknown Server Message ' + data[0]);
            break;
        }
        break;
      case 'disconnected':
//        this.reconnect();
        break;
      default:
        console.error('State ' + this.state + ' not implemented');
    }
  },
  
  reconnect: function() {
    console.log('RECONNECT!!!');
    this.disconnect();
//    this.connect();
  },
  
  _getMouseXY: function(e) {
    var obj=this.canvas; 
    var oXY=[0,0]; 
    while (obj.offsetParent) {
      oXY[0]=oXY[0]+obj.offsetLeft-obj.scrollLeft; 
      oXY[1]=oXY[1]+obj.offsetTop-obj.scrollTop;
      obj=obj.offsetParent;
    } 
    oXY[0]=e.clientX+document.body.scrollLeft+document.documentElement.scrollLeft-oXY[0];
    oXY[1]=e.clientY+document.body.scrollTop+document.documentElement.scrollTop-oXY[1];
    oXY[0]=oXY[0]/this.scale;
    oXY[1]=oXY[1]/this.scale;
    return oXY;
  },
  
  sendMouseCoords: function() {
    if (this.mouseCoords) {
      this.ws.send(new Uint8Array([5,this.mouseButtonState,
                                   this.mouseCoords[0]>>8,this.mouseCoords[0]&0xFF,
                                   this.mouseCoords[1]>>8,this.mouseCoords[1]&0xFF]).buffer);
      this.mouseCoords = null;
    }
  },
  
  mouseEnter: function(e) {
    this.canvas.focus();
    dojo.addClass(this.canvas,"firmosVNCActive");
    dojo.removeClass(this.canvas,"firmosVNCInactive");
    this.isActive = true;
  },
  
  mouseOut: function(e) {
    dojo.addClass(this.canvas,"firmosVNCInactive");
    dojo.removeClass(this.canvas,"firmosVNCActive");
    this.isActive = false;
  },

  mouseMoveListener: function(e) {
    if (!this.isActive) {
      this.mouseEnter(e);
    }
    this.mouseCoords = this._getMouseXY(e);
  },
  
  mouseDownListener: function(e) {
    this.mouseButtonState |= (1 << e.button); 
    var oXY = this._getMouseXY(e);
    this.ws.send(new Uint8Array([5,this.mouseButtonState,
                                 oXY[0]>>8,oXY[0]&0xFF,
                                 oXY[1]>>8,oXY[1]&0xFF]).buffer);
    this.mouseCoords = null;
  },
  
  mouseUpListener: function(e) {
    this.mouseButtonState ^= (1 << e.button); 
    var oXY = this._getMouseXY(e);
    this.ws.send(new Uint8Array([5,this.mouseButtonState,
                                 oXY[0]>>8,oXY[0]&0xFF,
                                 oXY[1]>>8,oXY[1]&0xFF]).buffer);  
    this.mouseCoords = null;
  },
  
  mouseClickListener: function(e) {
    return false;
  },
  
  contextMenuListener: function(e) {
    return false;
  },
  
  getSpecialKeyCode: function(e) {
    switch (e.keyCode) {
      case 8   : return 0xFF08;  // BackSpace
      case 9   : return 0xFF09;  // Tab
      case 13  : return 0xFF0D;  // Return or Enter
      case 27  : return 0xFF1B;  // Escape
      case 45  : return 0xFF63;  // Insert
      case 46  : return 0xFFFF;  // Delete
      case 36  : return 0xFF50;  // Home
      case 35  : return 0xFF57;  // End
      case 33  : return 0xFF55;  // Page Up
      case 34  : return 0xFF56;  // Page Down
      case 37  : return 0xFF51;  // Left
      case 38  : return 0xFF52;  // Up
      case 39  : return 0xFF53;  // Right
      case 40  : return 0xFF54;  // Down
      case 112 : return 0xFFBE;  // F1
      case 113 : return 0xFFBF;  // F2
      case 114 : return 0xFFC0;  // F3
      case 115 : return 0xFFC1;  // F4
      case 116 : return 0xFFC2;  // F5
      case 117 : return 0xFFC3;  // F6
      case 118 : return 0xFFC4;  // F7
      case 119 : return 0xFFC5;  // F8
      case 120 : return 0xFFC6;  // F9
      case 121 : return 0xFFC7;  // F10
      case 122 : return 0xFFC8;  // F11
      case 123 : return 0xFFC9;  // F12
      case 16  : return 0xFFE1;  // Shift
      case 17  : return 0xFFE3;  // Control
//      case 18  : return 0xFFE9;  // Alt
      case 18  : return 0xFF7E;  // RIGHT Alt
    }
    //send immediately since chrome and firefox send different which codes on keypress in this case
//    if ((e.ctrlKey || e.altKey)) { 
    //  return e.which;
//    }
    return 0;
  },
    
  keyDownListener: function(e) {
    if (this.isActive) {
      var sKeyCode = this.getSpecialKeyCode(e);
//      console.log('KEY DOWN: sKeyCode: ' + sKeyCode + ' keyCode:' + e.keyCode + ' - charByte: ' + 0 + ' - wich: ' + e.which + ' - charCode: ' + e.charCode + ' - keyChar: ' + e.keyChar + ' - keyCode: ' + e.keyCode + ' - keyIdentifier: ' + e.keyIdentifier);
      if (sKeyCode!=0) {
        this.stopEvent(e);
        this.ws.send(new Uint8Array([4,1,0,0,
                                     (sKeyCode>>24) & 0xFF,(sKeyCode>>16) & 0xFF,(sKeyCode>>8) & 0xFF,sKeyCode & 0xFF]).buffer);
      }
      return false;
    }
  },
  
  keyUpListener: function(e) {
    if (this.isActive) {
      var sKeyCode = this.getSpecialKeyCode(e);
//      console.log('KEY UP: sKeyCode: ' + sKeyCode + ' keyCode:' + e.keyCode + ' - charByte: ' + 0 + ' - wich: ' + e.which  + ' - charCode: ' + e.charCode +  ' - keyChar: ' + e.keyChar + ' - keyCode: ' + e.keyCode + ' - keyIdentifier: ' + e.keyIdentifier);
      if (sKeyCode) {
        this.stopEvent(e);
        this.ws.send(new Uint8Array([4,0,0,0,
                                     (sKeyCode>>24) & 0xFF,(sKeyCode>>16) & 0xFF,(sKeyCode>>8) & 0xFF,sKeyCode & 0xFF]).buffer);
      }
      return false;
    }
  },
  
  keyPressListener: function(e) {
    if (this.isActive) {
//      console.log('KEY PRESS: sKeyCode: ' + 0 + ' keyCode:' + e.keyCode + ' - charByte: ' + charBytes + ' - wich: ' + e.which  + ' - charCode: ' + e.charCode +  ' - keyChar: ' + e.keyChar + ' - keyCode: ' + e.keyCode + ' - keyIdentifier: ' + e.keyIdentifier);
      if ((e.which!=0) && (e.charCode!=0)) { 
        this.stopEvent(e);
        if (e.charCode>0) {
          var charBytes = [(e.charCode>>24) & 0xFF,(e.charCode>>16) & 0xFF,(e.charCode>>8) & 0xFF,e.charCode & 0xFF];
        } else {
          var charBytes = [(e.which>>24) & 0xFF,(e.which>>16) & 0xFF,(e.which>>8) & 0xFF,e.which & 0xFF];
        }
        this.ws.send(new Uint8Array([4,1,0,0,
                                     charBytes[0],charBytes[1],charBytes[2],charBytes[3],
                                     4,0,0,0,
                                     charBytes[0],charBytes[1],charBytes[2],charBytes[3]]).buffer);
      }
      return false;
    }
  },

  handleCopyrect: function(data,x,y,width,height,idx) {
    var sourceX = data[idx] * 256 + data[idx+1];
    idx+=2;
    var sourceY = data[idx] * 256 + data[idx+1];
    idx+=2;
    this.context.drawImage(this.canvas, sourceX, sourceY, width, height, x, y, width, height);
    return idx;
  },
  
  handleRaw: function(data,x,y,width,height,idx) {
    var img = this.context.createImageData(width, height);
    var startIdx,startDataIdx;
    for (var i=0; i < width * height; i++) {
      startIdx=i*4;
      startDataIdx=startIdx+idx;
      img.data[startIdx    ] = data[startDataIdx+ 2];
      img.data[startIdx + 1] = data[startDataIdx+ 1];
      img.data[startIdx + 2] = data[startDataIdx   ];
      img.data[startIdx + 3] = 255;// - data[startDataIdx+ 3];; // Set Alpha
    }
    this.context.putImageData(img, x, y);
    idx = startDataIdx + 4;
    return idx;
  },
  
  handleHextile: function(data,x,y,width,height,idx) {
    var x_tiles = Math.ceil(width / 16);
    var y_tiles = Math.ceil(height / 16);
    var tiles = x_tiles * y_tiles;
    
    var bgc = [0,0,0,255];
    var fgc = [0,0,0,255];
    var color = [0,0,0,255];
    var tileImage;
    for(var i=0;i<y_tiles;i++) {
      for(var j=0;j<x_tiles;j++) {
        var encoding=data[idx];
        idx++;
        var w = 16;
        var h = 16;
        if (i==(y_tiles-1)) {
          h = 16 - ((y_tiles * 16) - height);
        }
        if (j==(x_tiles-1)) {
          w = 16 - ((x_tiles * 16) - width);
        }
        var isize=w*h;
        
        if (encoding==0) {
          //fillrect
          this.context.fillStyle='rgb('+bgc[2]+','+bgc[1]+','+bgc[0]+')';
          this.context.fillRect(x+j*16,y+i*16,w,h);
        } else {
          if (encoding & 0x01) {
            //raw
            var startIdx,startDataIdx;
            if (isize==256) {
              tileImage = this.tileImage;
            }
            else {
              tileImage = this.context.createImageData(w, h);
            }
            for (var k=0; k < isize; k++) {
              startIdx=k*4;
              startDataIdx=startIdx+idx;
              tileImage.data[startIdx    ] = data[startDataIdx+ 2];
              tileImage.data[startIdx + 1] = data[startDataIdx+ 1];
              tileImage.data[startIdx + 2] = data[startDataIdx   ];
              tileImage.data[startIdx + 3] = 255;// - data[startDataIdx+ 3];; // Set Alpha
            }
            this.context.putImageData(tileImage, x+j*16, y+i*16);
            idx = startDataIdx + 4;
          } else {
            if (encoding & 0x02) { // background
              bgc = [data[idx],data[idx+1],data[idx+2],data[idx+3]];
              idx+=4;
            }
            if (encoding & 0x04) { // foreground
              fgc = [data[idx],data[idx+1],data[idx+2],data[idx+3]];
              idx+=4;
            }
            var cx = x+j*16;
            var cy = y+i*16;
            this.context.fillStyle='rgb('+bgc[2]+','+bgc[1]+','+bgc[0]+')';
            this.context.fillRect(cx,cy,w,h);
            if (encoding & 0x08) { // anysubrects
              var subrects = data[idx];
              idx++;
              for (var k=0; k<subrects;k++) {
                if (encoding & 0x10) { // subrectscoloured
                  color = [data[idx],data[idx+1],data[idx+2],data[idx+3]];
                  idx+=4;
                } else {
                  color = fgc;
                }
                var dx=data[idx] >> 4;
                var dy=data[idx] & 0x0f;
                idx++;
                var sw=(data[idx] >> 4) + 1;
                var sh=(data[idx] & 0x0f) + 1;
                idx++;
                this.context.fillStyle='rgb('+color[2]+','+color[1]+','+color[0]+')';
                this.context.fillRect(cx+dx,cy+dy,sw,sh);
              }
            }
          }
        }
      }    
    }
    return idx;
  },
  
  wsErrorListener: function(error) {
    console.error('wsError ' + JSON.stringify(error));
    this.reconnect();
  },
  
  wsCloseListener: function() {
    this.state = 'disconnected';
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
    }
  },
  
  wsOpenListener: function() {
    this.state = 'init';
  }
});

});
