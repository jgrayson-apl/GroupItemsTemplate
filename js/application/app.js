/*
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
  "boilerplate/ItemHelper",
  "boilerplate/UrlParamHelper",
  "dojo/i18n!./nls/resources",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/query",
  "dojo/on",
  "dojo/Deferred",
  "dstore/Memory",
  "dstore/Trackable",
  "dgrid/OnDemandList",
  "dgrid/OnDemandGrid",
  "dgrid/Selection",
  "dgrid/extensions/ColumnHider",
  "dgrid/extensions/DijitRegistry",
  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dojo/dom-construct",
  "dijit/registry",
  "dijit/form/TextBox",
  "dijit/Tooltip",
  "esri/portal/Portal"
], function (ItemHelper, UrlParamHelper, i18n,
             declare, lang, array, query, on, Deferred,
             Memory, Trackable, OnDemandList, OnDemandGrid, Selection, ColumnHider, DijitRegistry,
             dom, domAttr, domClass, domConstruct, registry, TextBox, Tooltip, Portal) {

  //--------------------------------------------------------------------------
  //
  //  Static Variables
  //
  //--------------------------------------------------------------------------

  var CSS = {
    loading: "boilerplate--loading",
    error: "boilerplate--error",
    errorIcon: "esri-icon-notice-round"
  };

  // TRACKABLE MEMORY STORE //
  var TrackableMemory = declare([Memory, Trackable]);

  return declare(null, {

    //--------------------------------------------------------------------------
    //
    //  Lifecycle
    //
    //--------------------------------------------------------------------------

    constructor: function () {
    },

    //--------------------------------------------------------------------------
    //
    //  Variables
    //
    //--------------------------------------------------------------------------

    config: null,

    direction: null,

    //--------------------------------------------------------------------------
    //
    //  Public Methods
    //
    //--------------------------------------------------------------------------

    init: function (boilerplateResponse) {
      if(boilerplateResponse) {
        this.direction = boilerplateResponse.direction;
        this.config = boilerplateResponse.config;
        this.settings = boilerplateResponse.settings;
        var boilerplateResults = boilerplateResponse.results;
        var webMapItem = boilerplateResults.webMapItem;
        var webSceneItem = boilerplateResults.webSceneItem;
        var groupData = boilerplateResults.group;

        document.documentElement.lang = boilerplateResponse.locale;

        this.urlParamHelper = new UrlParamHelper();
        this.itemHelper = new ItemHelper();

        this._setDirection();

        if(webMapItem) {
          this._createWebMap(webMapItem);
        }
        else if(webSceneItem) {
          this._createWebScene(webSceneItem);
        }
        else if(groupData) {
          this._createGroupGallery(groupData);
        }
        else {
          this.reportError(new Error("app:: Could not load an item to display"));
        }
      }
      else {
        this.reportError(new Error("app:: Boilerplate is not defined"));
      }
    },

    reportError: function (error) {
      // remove loading class from body
      domClass.remove(document.body, CSS.loading);
      domClass.add(document.body, CSS.error);
      // an error occurred - notify the user. In this example we pull the string from the
      // resource.js file located in the nls folder because we've set the application up
      // for localization. If you don't need to support multiple languages you can hardcode the
      // strings here and comment out the call in index.html to get the localization strings.
      // set message
      var node = dom.byId("loading_message");
      if(node) {
        node.innerHTML = "<h1><span class=\"" + CSS.errorIcon + "\"></span> " + i18n.error + "</h1><p>" + error.message + "</p>";
      }
      return error;
    },

    //--------------------------------------------------------------------------
    //
    //  Private Methods
    //
    //--------------------------------------------------------------------------

    _setDirection: function () {
      var direction = this.direction;
      var dirNode = document.getElementsByTagName("html")[0];
      domAttr.set(dirNode, "dir", direction);
    },

    _ready: function () {
      domClass.remove(document.body, CSS.loading);
      document.title = this.config.title;
    },

    _createWebMap: function (webMapItem) {
      this.itemHelper.createWebMap(webMapItem).then(function (map) {

        var viewProperties = {
          map: map,
          container: this.settings.webmap.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));

        require(["esri/views/MapView"], function (MapView) {

          var view = new MapView(viewProperties);

          view.then(function (response) {
            this.urlParamHelper.addToView(view, this.config);

            this._ready();

          }.bind(this), this.reportError);

        }.bind(this));

      }.bind(this), this.reportError);
    },

    _createWebScene: function (webSceneItem) {
      this.itemHelper.createWebScene(webSceneItem).then(function (map) {

        var viewProperties = {
          map: map,
          container: this.settings.webscene.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));

        require(["esri/views/SceneView"], function (SceneView) {

          var view = new SceneView(viewProperties);

          view.then(function (response) {

            this.urlParamHelper.addToView(view, this.config);

            this._ready();

          }.bind(this), this.reportError);

        }.bind(this));

      }.bind(this), this.reportError);
    },

    _createGroupGallery: function (groupData) {
      var groupInfoData = groupData.infoData;
      var groupItemsData = groupData.itemsData;

      if(!groupInfoData || !groupItemsData || groupInfoData.total === 0 || groupInfoData instanceof Error) {
        this.reportError(new Error("app:: group data does not exist."));
        return;
      }

      var info = groupInfoData.results[0];
      var items = groupItemsData.results;

      // PORTAL //
      this.portal = new Portal({ authMode: "immediate" });
      this.portal.load().then(function () {

        // GROUP INFO //
        this.groupInfo = groupInfoData.results[0];

        // DETAILS //
        var detailsNode = dom.byId("details-node");
        dom.byId("info-user-fullname").innerHTML = this.portal.user.fullName;
        dom.byId("info-portal-name").innerHTML = this.portal.name;
        dom.byId("info-group-title").innerHTML = this.groupInfo.title;

        // SET LAYOUT DISPLAY //
        var setItemLayout = function (layoutNode) {
          query(".layout-selected").removeClass("layout-selected");
          domClass.add(layoutNode, "layout-selected");
          registry.byId("main-center-pane").selectChild(registry.byId(lang.replace("option-pane-{id}", layoutNode)));
        };
        if(this.config.initialItemLayout === "list") {
          setItemLayout(dom.byId("layout-list"));
        }
        query(".layout-option").on("click", function (evt) {
          setItemLayout(evt.target);
          this.applyFilter();
        }.bind(this));

        // FETCH ALL //
        this.fetchAllNode = dom.byId("item-fetch-all-node");
        if(groupItemsData.results.length < groupItemsData.total) {
          domClass.remove(this.fetchAllNode, "dijitHidden");
          on(this.fetchAllNode, "click", function () {
            if(groupItemsData.total - groupItemsData.results.length > 500) {
              console.info("Too Many Items: ", groupItemsData);
            }
            domClass.add(document.body, CSS.loading);
            this.getItems(groupItemsData.nextQueryParams, true);
          }.bind(this));
        }

        // INITIALIZE FILTERS //
        this.initializeFilters();

        // TOTAL ITEM COUNT //
        this.itemTotal = groupItemsData.total;
        this.itemCountLabelNode = dom.byId("item-count-label-node");

        // ITEM STORE //
        this.itemStore = new TrackableMemory({ data: [] });
        // TRACK STORE UPDATES //
        this.itemStoreTrack = this.itemStore.track();
        this.itemStoreTrack.on("add", function () {
          if(this.itemStore.data.length < this.itemTotal) {
            this.itemCountLabelNode.innerHTML = lang.replace("{count} of {total}", {
              count: this.itemStore.data.length,
              total: this.itemTotal
            });
          } else {
            this.itemCountLabelNode.innerHTML = this.itemTotal;
            domClass.add(this.fetchAllNode, "dijitHidden");
          }
        }.bind(this));

        // ITEM GRID //
        this.itemGrid = new (declare([OnDemandList, DijitRegistry]))({
          loadingMessage: "Loading Items...",
          noDataMessage: "No Items",
          collection: this.itemStore,
          sort: "title",
          renderRow: function (item, options) {
            // ITEM CARD //
            var itemCard = domConstruct.create("div", { className: "item-card" });
            // THUMBNAIL //
            var imageParentNode = domConstruct.create("div", { className: "item-card-thumb" }, itemCard);
            domConstruct.create("span", { className: "itemType-badge type-" + item.type.replace(/ /g, "") }, imageParentNode);
            domConstruct.create("img", { src: item.thumbnailUrl }, imageParentNode);
            // TITLE //
            domConstruct.create("div", { className: "item-card-title", innerHTML: item.title.replace(/_/g, " ") }, itemCard);
            // TOOLTIP //
            var itemTooltip = new Tooltip({
              showDelay: 1000,
              label: lang.replace("{snippet}<hr>A {type} by {owner}", item),
              connectId: [itemCard]
            });
            return itemCard;
          }.bind(this)
        }, "item-grid-node");
        // ITEM SELECTED //
        this.itemGrid.on(".dgrid-row:click", function (evt) {
          // OPEN ITEM DETAILS PAGE //
          openItemDetailsPage(this.itemGrid.row(evt).data);
        }.bind(this));
        this.itemGrid.startup();

        // ITEM LIST //
        this.itemList = new (declare([OnDemandGrid, ColumnHider, DijitRegistry]))({
          loadingMessage: "Loading Items...",
          noDataMessage: "No Items",
          collection: this.itemStore,
          columns: this.getItemColumns(),
          sort: "title"
        }, "item-list-node");
        // ITEM SELECTED //
        this.itemList.on(".dgrid-row:click", function (evt) {
          // OPEN ITEM DETAILS PAGE //
          openItemDetailsPage(this.itemList.row(evt).data);
        }.bind(this));
        this.itemList.startup();

        /**
         *
         * @param item
         */
        var openItemDetailsPage = function (item) {
          // ITEM DETAILS PAGE URL //
          var itemDetailsPageUrl = lang.replace("{protocol}//{urlKey}.{customBaseUrl}/home/item.html?id={itemId}", {
            protocol: document.location.protocol,
            urlKey: this.portal.urlKey,
            customBaseUrl: this.portal.customBaseUrl,
            itemId: item.id
          });
          // OPEN ITEM DEATILS PAGE //
          window.open(itemDetailsPageUrl);
        }.bind(this);

        // LIST UPDATED
        this.itemList.on("dgrid-refresh-complete", function (evt) {
          dom.byId("filter-count-node").innerHTML = lang.replace("{count} of {total}", {
            count: evt.grid._total,
            total: this.itemStore.data.length
          });
        }.bind(this));

        // ADD ITEMS TO LIST //
        this.addItemsToList(groupItemsData, false);

        // CREATE ITEM TYPE FILTER //
        this.updateFilters();

        // APP READY //
        this._ready();

      }.bind(this), this._ready);

    },
    /**
     * ADD ITEMS TO LIST ONCE IT'S READY
     *
     * @param queryResponse
     * @param fetchAll
     */
    addItemsToList: function (queryResponse, fetchAll) {

      // MAKE SURE EACH ITEM IS READY BEFORE ADDING TO STORE //
      array.forEach(queryResponse.results, function (item) {
        item.then(function () {
          this.itemStore.add(item);
        }.bind(this));
      }.bind(this));

      // GET MORE ITEMS IF AVAILABLE //
      if(queryResponse.nextQueryParams.start > -1) {
        if(fetchAll) {
          this.getItems(queryResponse.nextQueryParams, true);
        }
      } else {
        // UPDATE ITEM TYPE FILTER //
        this.updateFilters();
        domClass.remove(document.body, CSS.loading);
      }

    },

    /**
     * GET ITEMS AND ADD TO STORE/LIST
     *
     * @param queryParameters
     * @param fetchAll
     */
    getItems: function (queryParameters, fetchAll) {
      this.portal.queryItems(queryParameters).then(function (response) {
        this.addItemsToList(response, fetchAll);
      }.bind(this));
    },

    /**
     * ITEM COLUMNS
     *
     * @returns {Array}
     */
    getItemColumns: function () {
      var columns = [];
      columns.push({
        label: "Thumbnail",
        field: "thumbnailUrl",
        hidden: !this.config.column_thumbnailUrl,
        renderCell: this.renderItemThumbnail
      });
      columns.push({
        label: "Title",
        field: "title",
        hidden: !this.config.column_title,
        renderCell: this.renderItemTitle
      });
      columns.push({
        label: "ID",
        field: "id",
        hidden: !this.config.column_id
      });
      columns.push({
        label: "Credits",
        field: "accessInformation",
        hidden: !this.config.column_accessInformation
      });
      columns.push({
        label: "Access",
        field: "licenseInfo",
        hidden: !this.config.column_licenseInfo,
        renderCell: this.renderItemAccess
      });
      columns.push({
        label: "Shared",
        field: "access",
        hidden: !this.config.column_access
      });
      columns.push({
        label: "Summary",
        field: "snippet",
        hidden: !this.config.column_snippet
      });
      columns.push({
        label: "Description",
        field: "description",
        hidden: !this.config.column_description,
        renderCell: this.renderItemDescription
      });
      columns.push({
        label: "Type",
        field: "type",
        hidden: !this.config.column_type
      });
      columns.push({
        label: "Type Keywords",
        field: "typeKeywords",
        hidden: !this.config.column_typeKeywords
      });
      columns.push({
        label: "Tags",
        field: "tags",
        canSort: false,
        hidden: !this.config.column_tags
      });
      columns.push({
        label: "Created",
        field: "created",
        hidden: !this.config.column_created,
        formatter: this.formatDateValue
      });
      columns.push({
        label: "Modified",
        field: "modified",
        hidden: !this.config.column_modified,
        formatter: this.formatDateValue
      });
      columns.push({
        label: "Owner",
        field: "owner",
        hidden: !this.config.column_owner
      });
      columns.push({
        label: "Avg Rating",
        field: "avgRating",
        hidden: !this.config.column_avgRating
      });
      columns.push({
        label: "Num Ratings",
        field: "numRatings",
        hidden: !this.config.column_numRatings
      });
      columns.push({
        label: "Num Views",
        field: "numViews",
        hidden: !this.config.column_numViews
      });
      columns.push({
        label: "Num Comments",
        field: "numComments",
        hidden: !this.config.column_numComments
      });

      return columns;
    },

    renderItemTitle: function (object, value, node, options) {
      return domConstruct.create("div", { className: "item-title", innerHTML: value || "[No Title]" });
    },

    renderItemDescription: function (object, value, node, options) {
      domClass.toggle(node, "item-has-value", (value != null));
      return domConstruct.create("div", { className: "item-as-html", innerHTML: value || "[empty]" });
    },

    renderItemAccess: function (object, value, node, options) {
      domClass.toggle(node, "item-has-value", (value != null));
      return domConstruct.create("div", { className: "item-as-html", innerHTML: value || "[empty]" });
    },

    renderItemThumbnail: function (object, value, node, options) {
      return domConstruct.create("img", { className: "item-thumbnail", src: value || "./images/no_preview.gif" });
    },

    formatDateValue: function (value) {
      return (new Date(value)).toLocaleString();
    },

    /**
     *
     */
    initializeFilters: function () {

      // ITEM TEXT FILTER //
      if(this.config.useTextFilter) {
        // TEXT FILTER INPUT //
        var filterInput = new TextBox({
          style: "width:100%;padding:2px;color:#0079c1;",
          value: this.config.itemTextFilter,
          placeHolder: "...text filter...",
          title: "Filter based on the title, summary, and description",
          intermediateChanges: true,
          onChange: function (filter) {
            this.itemTextFilter = filter;
            this.applyFilter();
          }.bind(this)
        }, "text-filter-input-node");
        // CLEAR TEXT FILTER //
        var clearTextFilterNode = dom.byId("clear-text-filter");
        on(clearTextFilterNode, "click", function () {
          filterInput.set("value", null);
        });
      } else {
        domClass.add("text-filter-pane", "dijitHidden");
      }

      // ITEM ACCESS FILTER //
      if(this.config.useAccessFilter) {

        var accessInfos = {
          public: {
            label: "Everyone",
            icon: "esri-icon-upload"
          },
          org: {
            label: "Shared to Organization",
            icon: "esri-icon-organization"
          },
          shared: {
            label: "Shared to Groups",
            icon: "esri-icon-group"
          },
          private: {
            label: "Not Shared",
            icon: "esri-icon-locked"
          }
        };

        // STORE OF ITEM ACCESS //
        this.itemAccessStore = new TrackableMemory({ data: [] });
        // ITEM ACCESS LIST //
        this.itemAccessList = new (declare([OnDemandList, Selection]))({
          className: "dgrid-autoheight",
          selectionMode: "single",
          deselectOnRefresh: false,
          loadingMessage: "Loading Items Access...",
          noDataMessage: "No Item Access",
          collection: this.itemAccessStore,
          sort: "label",
          renderRow: function (itemAccess, options) {
            var accessInfo = accessInfos[itemAccess.label];
            var itemAccessNode = domConstruct.create("div", { className: "item-type" });
            domConstruct.create("span", { className: "item-access " + accessInfo.icon }, itemAccessNode);
            domConstruct.create("span", { className: "item-access-label", innerHTML: accessInfo.label }, itemAccessNode);
            return itemAccessNode;
          }
        }, "item-access-list-node");
        // ITEM TYPE SELECTED //
        this.itemAccessList.on("dgrid-select", function (evt) {
          this.itemAccess = evt.rows[0].data;
          this.applyFilter();
        }.bind(this));
        this.itemAccessList.on("dgrid-deselect", function (evt) {
          this.itemAccess = null;
          this.applyFilter();
        }.bind(this));
        this.itemAccessList.startup();

        // CLEAR TYPE FILTER //
        on(dom.byId("clear-access-filter"), "click", function () {
          this.itemAccessList.clearSelection();
        }.bind(this));
      } else {
        domClass.add("access-filter-pane", "dijitHidden");
      }

      // ITEM TYPES FILTER //
      if(this.config.useTypeFilter) {
        // STORE OF ITEM TYPES //
        this.itemTypesStore = new TrackableMemory({ data: [] });
        // ITEM TYPES LIST //
        this.itemTypeList = new (declare([OnDemandList, Selection]))({
          className: "dgrid-autoheight",
          selectionMode: "single",
          deselectOnRefresh: false,
          loadingMessage: "Loading Items Types...",
          noDataMessage: "No Item Types",
          collection: this.itemTypesStore,
          sort: "label",
          renderRow: function (itemType, options) {
            var itemTypeNode = domConstruct.create("div", { className: "item-type" });
            domConstruct.create("span", { className: "itemType-list type-" + itemType.label.replace(/ /g, "") }, itemTypeNode);
            domConstruct.create("span", { className: "itemType-label", innerHTML: itemType.label }, itemTypeNode);
            return itemTypeNode;
          }
        }, "item-type-list-node");
        // ITEM TYPE SELECTED //
        this.itemTypeList.on("dgrid-select", function (evt) {
          this.itemType = evt.rows[0].data;
          this.applyFilter();
        }.bind(this));
        this.itemTypeList.on("dgrid-deselect", function (evt) {
          this.itemType = null;
          this.applyFilter();
        }.bind(this));
        this.itemTypeList.startup();

        // CLEAR TYPE FILTER //
        on(dom.byId("clear-type-filter"), "click", function () {
          this.itemTypeList.clearSelection();
        }.bind(this));
      } else {
        domClass.add("type-filter-pane", "dijitHidden");
      }

      // ITEM TYPE KEYWORDS FILTER //
      if(this.config.useTypeKeywordsFilter) {
        // STORE OF ITEM TYPE KEYWORDS //
        this.itemTypeKeywordsStore = new TrackableMemory({ data: [] });
        // LIST OF ITEM TYPE KEYWORDS//
        this.itemTypeKeywordsList = new (declare([OnDemandList, Selection]))({
          className: "dgrid-autoheight",
          selectionMode: "toggle",
          deselectOnRefresh: false,
          loadingMessage: "Loading Items TypeKeywords...",
          noDataMessage: "No Item TypeKeywords",
          sort: "label",
          collection: this.itemTypeKeywordsStore,
          renderRow: function (itemType, options) {
            return domConstruct.create("span", { className: "item-type-keywords", innerHTML: itemType.label });
          }
        }, "item-type-keywords-list-node");
        // ITEM TYPE SELECTED //
        this.itemTypeKeywordsList.on("dgrid-select", function (evt) {
          this.itemTypeKeywords = this.itemTypeKeywordsList.selection;
          this.applyFilter();
        }.bind(this));
        this.itemTypeKeywordsList.on("dgrid-deselect", function (evt) {
          this.applyFilter();
        }.bind(this));
        this.itemTypeKeywordsList.startup();

        // CLEAR TYPE FILTER //
        on(dom.byId("clear-type-keywords-filter"), "click", function () {
          this.itemTypeKeywordsList.clearSelection();
        }.bind(this));
      } else {
        domClass.add("type-keywords-filter-pane", "dijitHidden");
      }

      // ITEM TAGS FILTER //
      if(this.config.useTagsFilter) {
        // STORE OF ITEM TAGS //
        this.itemTagsStore = new TrackableMemory({ data: [] });
        // ITEM TAGS LIST //
        this.itemTagList = new (declare([OnDemandList, Selection]))({
          className: "dgrid-autoheight",
          selectionMode: "toggle",
          deselectOnRefresh: false,
          loadingMessage: "Loading Items Tags...",
          noDataMessage: "No Item Tags",
          sort: "label",
          collection: this.itemTagsStore,
          renderRow: function (itemType, options) {
            return domConstruct.create("span", { className: "item-tag", innerHTML: itemType.label });
          }
        }, "item-tag-list-node");
        // ITEM TYPE SELECTED //
        this.itemTagList.on("dgrid-select", function (evt) {
          this.itemTags = this.itemTagList.selection;
          this.applyFilter();
        }.bind(this));
        this.itemTagList.on("dgrid-deselect", function (evt) {
          this.applyFilter();
        }.bind(this));
        this.itemTagList.startup();

        // CLEAR TYPE FILTER //
        on(dom.byId("clear-tag-filter"), "click", function () {
          this.itemTagList.clearSelection();
        }.bind(this));
      } else {
        domClass.add("tags-filter-pane", "dijitHidden");
      }

    },

    /**
     * UPDATE FILTERS
     */
    updateFilters: function () {

      // WHY TYPE KEYWORD OF NULL? //
      var ignoreKeywords = ["null"];

      // POPULATE UNIQUE LIST OF ITEM TYPES //
      this.itemStore.fetch().then(function (items) {
        array.forEach(items, function (item) {

          // ACCESS //
          if(this.config.useAccessFilter) {
            var itemAccess = this.itemAccessStore.getSync(item.access);
            if(!itemAccess) {
              this.itemAccessStore.add({ id: item.access, label: item.access });
            }
          }

          // TYPE //
          if(this.config.useTypeFilter) {
            var itemType = this.itemTypesStore.getSync(item.type);
            if(!itemType) {
              this.itemTypesStore.add({ id: item.type, label: item.type });
            }
          }

          // TYPE KEYWORDS //
          if(this.config.useTypeKeywordsFilter) {
            array.forEach(item.typeKeywords, function (typeKeyword) {
              if(array.indexOf(ignoreKeywords, typeKeyword) === -1) {
                var itemTypeKeyword = this.itemTypeKeywordsStore.getSync(typeKeyword);
                if(!itemTypeKeyword) {
                  this.itemTypeKeywordsStore.add({ id: typeKeyword, label: typeKeyword });
                }
              }
            }.bind(this));
          }

          // TAGS //
          if(this.config.useTagsFilter) {
            array.forEach(item.tags, function (tag) {
              var itemTag = this.itemTagsStore.getSync(tag);
              if(!itemTag) {
                this.itemTagsStore.add({ id: tag, label: tag });
              }
            }.bind(this));
          }

        }.bind(this));

        // APPLY FILTERS //
        this.applyFilter();
      }.bind(this));

    },

    /**
     *
     */
    applyFilter: function () {

      // ITEM STORE FILTER //
      var itemStoreFilter = new this.itemStore.Filter();
      // FILTERED ITEMS //
      var filteredItems = this.itemStore;

      // ITEM ACCESS FILTER //
      if(this.itemAccess) {
        // TYPE //
        var itemAccessFilter = itemStoreFilter.eq("access", this.itemAccess.label);
        // FILTERED ITEMS //
        filteredItems = filteredItems.filter(itemAccessFilter);
      }

      // ITEM TYPE FILTER //
      if(this.itemType) {
        // TYPE //
        var itemTypeFilter = itemStoreFilter.eq("type", this.itemType.label);
        // FILTERED ITEMS //
        filteredItems = filteredItems.filter(itemTypeFilter);
      }

      // TEXT FILTER //
      if(this.itemTextFilter) {
        var itemFilterRegExp = new RegExp(this.itemTextFilter, "i");

        // TITLE //
        var titleFilter = itemStoreFilter.match("title", itemFilterRegExp);
        // SNIPPET //
        var snippetFilter = itemStoreFilter.match("snippet", itemFilterRegExp);
        // DESCRIPTION //
        var descriptionFilter = itemStoreFilter.match("description", itemFilterRegExp);

        // FILTERED ITEMS //
        filteredItems = filteredItems.filter(titleFilter.or(snippetFilter).or(descriptionFilter));
      }

      // TYPE KEYWORDS //
      if(this.itemTypeKeywords) {
        var typeKeywordsFilter = itemStoreFilter.contains("typeKeywords", Object.keys(this.itemTypeKeywords));
        filteredItems = filteredItems.filter(typeKeywordsFilter);
      }

      // TAGS //
      if(this.itemTags) {
        var tagFilter = itemStoreFilter.contains("tags", Object.keys(this.itemTags));
        filteredItems = filteredItems.filter(tagFilter);
      }

      // UPDATE LIST //
      if(this.itemList) {
        this.itemList.set("collection", filteredItems);
      }
      // UPDATE GRID //
      if(this.itemGrid) {
        this.itemGrid.set("collection", filteredItems);
      }

    }

  });
});
