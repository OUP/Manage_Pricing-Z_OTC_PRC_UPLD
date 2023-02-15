sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
    "sap/ui/table/RowSettings",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/Fragment",
    "sap/m/Text",
    "sap/m/MessageToast",
    "sap/m/OverflowToolbar",
    "sap/m/Button",
    "sap/m/ToolbarSpacer",
    "sap/m/Title",
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  function (
    Controller,
    JSONModel,
    Table,
    Column,
    RowSettings,
    Filter,
    FilterOperator,
    Spreadsheet,
    Fragment,
    Text,
    MessageToast,
    OverflowToolbar,
    Button,
    ToolbarSpacer,
    Title
  ) {
    "use strict";

    let _oViewModel = new JSONModel();
    let _oDataModel;
    let _oView;
    let _oTableContainer;
    let _sUuidUpload;
    let _oFile;
    let _oFileUploader;
    let _oFilterBarContext;

    let _smartFilterBar = null;
    let _oConditionTypeData = null;

    let _oViewImportHistory = null;

    // upload url
    const _sUrlCheck = "/sap/opu/odata/sap/ZOTC_PRICING_UPLOAD_SRV/FileSet";

    return Controller.extend("oup.otc.pricingupload.controller.Main", {
      onInit: function () {
        // view
        _oView = this.getView();

        // table
        _oTableContainer = _oView.byId("idWorkListTableContainer");

        // hide table
        _oTableContainer.setVisible(false);

        // odata model
        _oDataModel = this.getOwnerComponent().getModel();

        // file uploader
        _oFileUploader = _oView.byId("fileUploader");

        // apply content density mode to root view
        _oView.addStyleClass(this.getOwnerComponent().getContentDensityClass());

        // Model used to manipulate control states
        const oData = {
          messageType: "None",
          messageText: "Test",
          messageVisible: false,
          action: "Report",
        };

        // Set data to model
        _oViewModel.setData(oData);

        // set model to view
        _oView.setModel(_oViewModel, "oViewModel");

        _smartFilterBar = _oView.byId("smartFilterBar");
      },

      onViewImportHistory: function () {
        // create dialog lazily
        if (!_oViewImportHistory) {
          Fragment.load({
            id: _oView.getId(),
            name: "oup.otc.pricingupload.view.fragment.ViewImportHistory",
            controller: this,
          }).then((oDialog) => {
            _oView.addDependent(oDialog);
            _oViewImportHistory = oDialog;

            // open dialog
            oDialog.open();
          });
        } else {
          _oViewImportHistory.open();
        }
      },

      onImportHistoryDialogConfirm: function (oEvent) {
        // reset the filter
        var oBinding = oEvent.getSource().getBinding("items");
        oBinding.filter([]);

        var aContexts = oEvent.getParameter("selectedContexts");
        if (aContexts && aContexts.length > 0) {
          var oContext = aContexts[0].getObject();

          _sUuidUpload = oContext.FileId;

          _oConditionTypeData = {
            ConditionType: oContext.ConditionType,
            TableName: oContext.TableName,
          };

          // load responsive table
          this._loadResponseTable("ViewImportHistory" /* action */);
        }
      },

      onImportHistoryDialogClose: function (oEvent) {
        // reset the filter
        var oBinding = oEvent.getSource().getBinding("items");
        oBinding.filter([]);
      },

      onImportHistoryDialogSearch: function (oEvent) {
        var sValue = oEvent.getParameter("value");
        var oFilter = new Filter(
          "ConditionType",
          FilterOperator.Contains,
          sValue
        );
        var oBinding = oEvent.getSource().getBinding("items");
        oBinding.filter([oFilter]);
      },

      onAssignedFiltersChanged: function () {
        var oStatusText = _oView.byId("statusText");
        if (oStatusText && _smartFilterBar) {
          var sText = _smartFilterBar.retrieveFiltersWithValuesAsText();

          oStatusText.setText(sText);
        }
      },

      /**
       * Getter for the resource bundle.
       * @public
       * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
       */
      getResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },

      onFilterBarInitialized: function (oEvent) {
        const sFilterName = "ConditionTypeDetail";
        const oSource = oEvent.getSource();
        const sConditionTypeId = `${oSource.getId()}-filterItemControl_BASIC-${sFilterName}`;
        const oConditionType = sap.ui.getCore().byId(sConditionTypeId);

        if (oConditionType) {
          const oSuggestionItemSelectedEvent = (oEvent) => {
            _oConditionTypeData = oEvent
              .getParameter("selectedRow")
              .getBindingContext()
              .getObject();
          };

          // attach suggestion item selection event
          oConditionType.attachSuggestionItemSelected(
            oSuggestionItemSelectedEvent
          );

          const fnValueHelp = () => {
            jQuery.sap.delayedCall(1000, this, function () {
              const sValueHelpId = `${oSource.getId()}-filterItemControl_BASIC-${sFilterName}-valueHelpDialog-table`;
              const oConditionTypeValueHelp = sap.ui
                .getCore()
                .byId(sValueHelpId);

              // on row selection change event trigger
              const oRowSelectionChangeEvent = (oEvent) => {
                _oConditionTypeData = oEvent
                  .getParameter("rowContext")
                  .getObject();
              };

              // row selection change
              oConditionTypeValueHelp.attachRowSelectionChange(
                oRowSelectionChangeEvent
              );
            });
          };

          // attach
          oConditionType.attachValueHelpRequest(fnValueHelp);
        }
      },

      onFilterBarGoPress: function () {
        // trigger request to backend
        this._loadResponseTable("Report" /* action */);
      },

      onDownloadTemplatePress: function () {
        if (!_oConditionTypeData) {
          MessageToast.show("Please enter a valid Condtion Type");
          return;
        }

        // load filter data
        const oFilter = this._getFilterObject();

        let sURL = `${_oDataModel.sServiceUrl}/FileDownloadSet(ConditionType='${_oConditionTypeData.ConditionType}',TableName='${_oConditionTypeData.TableName}',Scale=${oFilter.Scale})/$value`;
        sap.m.URLHelper.redirect(sURL, true);
      },

      _getFilterObject: function () {
        let oUrlParameters = {};

        const fnGetValuesFromControl = (oControl, sProperty) => {
          const sControlName = oControl.getMetadata().getName();
          let sInput = "";

          if (
            sControlName === "sap.ui.comp.smartfilterbar.SFBMultiInput" ||
            sControlName === "sap.m.MultiInput"
          ) {
            const aTokens = oControl.getTokens();

            for (let i = 0, iLen = aTokens.length; i < iLen; i++) {
              sInput += `${aTokens[i].getKey()}|`;
            }
          } else if (sControlName === "sap.m.Input") {
            sInput = oControl.getValue();
          } else if (
            sControlName === "sap.m.ComboBox" ||
            sControlName === "sap.m.Select"
          ) {
            sInput = oControl.getSelectedKey();

            // in case of true/ false we need to change it to 'X'
            if (sInput === "true" || sInput === "false") {
              sInput = sInput === "true";
            }
          }

          return sInput;
        };

        // all filter items
        const aFilterItems = _smartFilterBar.getFilterGroupItems();

        for (let i = 0, iLen = aFilterItems.length; i < iLen; i++) {
          if (aFilterItems[i].getVisibleInFilterBar()) {
            let oControl = sap.ui.getCore().byId(aFilterItems[i]._sControlId);
            let sKey = aFilterItems[i].getName();

            oUrlParameters[sKey] = fnGetValuesFromControl(oControl, sKey);
          }
        }

        return oUrlParameters;
      },

      _getFilters: function () {
        const aFilters = [];

        const fnResolveTimeDifference = (dateTime) => {
          if (dateTime !== undefined && dateTime !== null && dateTime !== "") {
            var offSet = dateTime.getTimezoneOffset();
            var offSetVal = offSet / 60;
            var hours = Math.floor(Math.abs(offSetVal));
            var minutes = Math.floor((Math.abs(offSetVal) * 60) % 60);
            dateTime = new Date(dateTime.setHours(hours, minutes, 0, 0));
            return dateTime;
          }
          return null;
        };

        const fnGetValuesFromControl = (oControl, sProperty) => {
          const sControlName = oControl.getMetadata().getName();
          let oFilter;

          if (
            sControlName === "sap.ui.comp.smartfilterbar.SFBMultiInput" ||
            sControlName === "sap.m.MultiInput"
          ) {
            const aTokens = oControl.getTokens();
            const iLen = aTokens.length;
            let i = 0;

            if (iLen === 1) {
              if (sProperty === "LocalSalesStatus") {
                oFilter = new Filter(
                  sProperty,
                  FilterOperator.EQ,
                  aTokens[0].getText()
                );
              } else {
                oFilter = new Filter(
                  sProperty,
                  FilterOperator.EQ,
                  aTokens[0].getKey()
                );
              }
            } else if (iLen > 1) {
              let aFilterTokens = [];

              for (i; i < iLen; i++) {
                if (sProperty === "LocalSalesStatus") {
                  aFilterTokens.push(
                    new Filter(sProperty, FilterOperator.EQ, aTokens[i].getText())
                  );
                } else {
                  aFilterTokens.push(
                    new Filter(sProperty, FilterOperator.EQ, aTokens[i].getKey())
                  );
                }
              }

              // add the multi input tokens to a filter
              oFilter = new Filter({
                filters: aFilterTokens,
                and: false,
              });
            }
          } else if (sControlName === "sap.m.Input") {
            // check if input value available
            if (oControl.getValue()) {
              oFilter = new Filter(
                sProperty,
                FilterOperator.EQ,
                oControl.getValue()
              );
            }
          } else if (
            sControlName === "sap.m.ComboBox" ||
            sControlName === "sap.m.Select"
          ) {
            // check if input value available
            let sValue = oControl.getSelectedKey();

            // in case of true/ false we need to change it to 'X'
            if (sValue === "true" || sValue === "false") {
              sValue = sValue === "true";
            }

            // filter value for select and combobox
            oFilter = new Filter(sProperty, FilterOperator.EQ, sValue);
          } else if (sControlName === "sap.m.DatePicker") {
            const oDate = oControl.getDateValue();

            if (oDate) {
              // filter value for date
              oFilter = new Filter(
                sProperty,
                FilterOperator.EQ,
                fnResolveTimeDifference(oDate)
              );
            }
          } else if (sControlName === "sap.m.DateRangeSelection") {
            const oFromDate = oControl.getFrom();
            const oToDate = oControl.getTo();

            if (oFromDate && oToDate) {
              // filter value for date range
              oFilter = new Filter(
                sProperty,
                FilterOperator.BT,
                fnResolveTimeDifference(oFromDate),
                fnResolveTimeDifference(oToDate)
              );
            }
          }

          return oFilter;
        };

        // all filter items
        const aFilterItems = _smartFilterBar.getFilterGroupItems();

        for (let i = 0, iLen = aFilterItems.length; i < iLen; i++) {
          if (aFilterItems[i].getVisibleInFilterBar()) {
            let oControl = sap.ui.getCore().byId(aFilterItems[i]._sControlId);
            let sKey = aFilterItems[i].getName();

            // skip below properties
            if (sKey === "ConditionTypeDetail") {
              continue;
            }

            let oFilter = fnGetValuesFromControl(oControl, sKey);

            if (oFilter) {
              aFilters.push(oFilter);
            }
          }
        }

        return aFilters;
      },

      onResetPress: function () {
        // clear value help status and file uploader file
        // sales org - value help
        _oViewModel.setProperty("/salesOrganizationVS", "None");

        // file uploader - value help
        _oViewModel.setProperty("/fileUploadVS", "None");

        // file uploader - value
        _oFileUploader.clear();

        // context path
        const sPath = _oFilterBarContext.getPath();

        // reset context
        _oDataModel.setProperty(`${sPath}/SalesOrganization`, "");

        // enable upload
        _oViewModel.setProperty("/enableUpload", true);
      },

      onFileChange: function (oEvent) {
        this._initMessageStrips();

        let oFiles = oEvent.getParameter("files");
        let oFileUploader = _oView.byId("fileUploader");

        if (oFiles.length !== 0) {
          // save file for deployment
          _oFile = oFiles[0];

          // reg exp for pattern matching - 'XXXX_XXXX_TemplateName'
          const oRegExp = new RegExp(/^[A-Z0-9]{4}\_[A-Z0-9]{4}\_.*$/i);

          if (!oRegExp.test(oFiles[0].name)) {
            const sMessage =
              "No template id found in the provided file name, kindly provide template id in the file name to understand the file type." +
              "\n\nSample file name with template id - 'XXXX_XXXX_TemplateName'";

            _oViewModel.setProperty("/messageType", "Error");
            _oViewModel.setProperty("/messageText", sMessage);
            _oViewModel.setProperty("/messageVisible", true);

            // clear file uploader
            oFileUploader.clear();
          }
        }
      },

      onUploadPress: function () {
        try {
          // load filter data
          const oFilter = this._getFilterObject();

          // upload file name
          let sFileName = _oFileUploader.getValue();

          if (!sFileName) {
            throw "Kindly select a valid file to upload template.";
          }

          // check for sales organisation
          if (!oFilter.SalesOrganization) {
            throw "Kindly provide valid Sales Organization to upload template.";
          }

          // check for Condition Type
          if (!oFilter.ConditionTypeDetail) {
            throw "Kindly provide valid Condition Type to upload template.";
          }

          // trigger upload
          this._fnPost(
            oFilter.SalesOrganization,
            oFilter.Scale,
            _oConditionTypeData.ConditionType,
            _oConditionTypeData.TableName,
            sFileName
          );

          // disable upload
          // _oViewModel.setProperty("/enableUpload", false);
        } catch (error) {
          MessageToast.show(error);
        }
      },

      onTestImportPress: function () {
        this._loadResponseTable("TestImport" /* action */);
      },

      onImportPress: function () {
        this._loadResponseTable("Import" /* action */);
      },

      _initMessageStrips: function () {
        _oViewModel.setProperty("/messageType", "None");
        _oViewModel.setProperty("/messageText", "");
        _oViewModel.setProperty("/messageVisible", false);
      },

      _fnPost: function (
        sSalesOrg,
        sScale,
        sConditionType,
        sTableName,
        sFileName
      ) {
        // ajax setup
        jQuery.ajaxSetup({
          cache: false,
        });

        // remove file extension
        let sFileNameFormatted = sFileName.match(/([^\/]+)(?=\.\w+$)/)[0];

        // remove template id
        sFileNameFormatted = sFileNameFormatted.substr(4);

        // post request
        jQuery.ajax({
          url: _sUrlCheck,
          async: false,
          cache: false,
          contentType: _oFile.type,
          data: _oFile,
          type: "POST",
          processData: false,
          contentType: false,
          beforeSend: (xhr) => {
            xhr.setRequestHeader(
              "x-csrf-token",
              _oDataModel.getSecurityToken()
            );
            xhr.setRequestHeader(
              "slug",
              `${sSalesOrg}|${sConditionType}|${sTableName}|${sScale}|${sFileName}`
            );
          },
          success: (oData) => {
            try {
              _sUuidUpload = oData.firstElementChild
                .getElementsByTagName("m:properties")[0]
                .getElementsByTagName("d:ID")[0].innerHTML;

              this._loadResponseTable("Upload" /* action */);

              // file uploader - value
              _oFileUploader.clear();
            } catch (error) {
              MessageToast.show("Failed to read File ID!");
            }
          },
          error: (oError) => {
            try {
              const oParser = new DOMParser();
              const oXmlDoc = oParser.parseFromString(
                oError.responseText,
                "text/xml"
              );
              const sMessage =
                oXmlDoc.getElementsByTagName("message")[0].innerHTML;

              _oViewModel.setProperty("/messageVisible", true);
              _oViewModel.setProperty("/messageType", "Error");
              _oViewModel.setProperty(
                "/messageText",
                `${sFileNameFormatted} - ${sMessage}`
              );
            } catch (error) {
              // un handled message
              MessageToast.show("File Upload Error!");
            }
          },
        });
      },

      _loadResponseTable: function (sAction) {
        _oTableContainer.destroyItems();

        const fnSuccess = (oDataResponse) => {
          try {
            if (oDataResponse.results.length === 0) {
              MessageToast.show("No Data available!");
              return;
            }

            // get the first array object
            const oData = oDataResponse.results[0];
            let aHeaderDataFields = oData.TableHeaderSet.results || [];
            let aItemDataFields = oData.TableItemSet.results || [];
            let aTableProperties = [];
            let sStatusFieldProperty = "";
            let sMessageType = "None";
            let sMessageText = "Test";
            let bMessageVisible = false;
            let aColumnConfig = [];

            //Overflow Toolbar
            var oOverflowToolbar = new OverflowToolbar({
              content: [
                new Title({ text: "ITEMS (" + aItemDataFields.length + ")" }),
                new ToolbarSpacer(),
                new Button({
                  id: "idDownloadResultsBtn",
                  text: "Download",
                  icon: "sap-icon://excel-attachment",
                  enabled: false,
                  press: () => {
                    // const hexToBase64 = (hexStr) => {
                    //   return btoa(
                    //     [...hexStr].reduce(
                    //       (acc, _, i) =>
                    //         (acc += !((i - 1) & 1)
                    //           ? String.fromCharCode(
                    //               parseInt(hexStr.substring(i - 1, i + 1), 16)
                    //             )
                    //           : ""),
                    //       ""
                    //     )
                    //   );
                    // };

                    // const sBase64 = hexToBase64(oData.BinaryString);
                    // const blob = atob(sBase64);
                    // const link = document.createElement("a");
                    // if (link.download !== undefined) {
                    //   link.href =
                    //     "data:text/csv;charset=utf-8,sep=|\n" + encodeURI(blob);
                    //   link.target = "_blank";
                    //   link.download = `${_oConditionTypeData.ConditionType}_${_oConditionTypeData.TableName}.csv`;
                    //   link.click();
                    // }

                    let oSettings, oSheet, dataSource;

                    // data source for the excel
                    let aItemDataFields1 = JSON.parse(
                      JSON.stringify(aItemDataFields)
                    );

                    // clear data source
                    // dataSource = [];

                    // format data to remove description
                    // for (let i = 0, iLen = aItemDataFields1.length; i < iLen; i++) {
                    //   let object = aItemDataFields1[i];

                    //   for (const property in object) {
                    //     if (
                    //       typeof object[property] === "string" ||
                    //       object[property] instanceof String
                    //     ) {
                    //       object[property] = object[property].split("(")[0];
                    //     }
                    //   }

                    //   dataSource.push(object);
                    // }

                    oSettings = {
                      workbook: { columns: aColumnConfig },
                      dataSource: aItemDataFields1,
                      fileName: `${_oConditionTypeData.ConditionType}_${_oConditionTypeData.TableName}`,
                    };

                    oSheet = new Spreadsheet(oSettings);
                    oSheet
                      .build()
                      .then(() => {
                        MessageToast.show("Spreadsheet export has finished");
                      })
                      .finally(oSheet.destroy());
                  },
                }),
              ],
            });

            // create new sap.ui.table.GridTable
            let oTable = new Table({
              visibleRowCountMode: "Auto",
              selectionMode: "None",
              minAutoRowCount: 8,
              extension: [oOverflowToolbar],
            }).addStyleClass("sapUiSmallMargin");

            // identify columns
            for (let [index, oData] of aHeaderDataFields.entries()) {
              // push to table property array
              aTableProperties.push({
                property: `Field${index + 1}`,
                label: oData.FieldText,
              });
            }

            // add columns to table
            for (let oData of aTableProperties) {
              // row highlight on test import
              // check for status field
              if (oData.label.toUpperCase() === "STATUS") {
                // save status field property to check errors found
                sStatusFieldProperty = oData.property;

                // formatter for row highliter
                const formatter = (sValue) => {
                  let sResponse = "None";

                  switch (sValue) {
                    case "ERROR":
                      sResponse = "Error";
                      break;
                    case "SUCCESS":
                      sResponse = "Success";
                      break;
                    case "INFO":
                    case "INFORMATION":
                      sResponse = "Information";
                      break;
                    case "WARNING":
                      sResponse = "Warning";
                      break;
                    default:
                      sResponse = "None";
                  }

                  return sResponse;
                };

                // status row setting for table
                oTable.setRowSettingsTemplate(
                  new RowSettings({
                    highlight: {
                      path: oData.property,
                      formatter,
                    },
                  })
                );
              } else {
                // value
                let oControl = new Text({
                  text: `{${oData.property}}`,
                  wrapping: false,
                });

                // label
                let oColumn = new Column({
                  autoResizable: true,
                  label: new Text({
                    text: oData.label,
                  }),
                  template: oControl,
                  width: "auto",
                  //   width:
                  //     oData.label.toUpperCase() === "COMMENTS"
                  //       ? "45rem"
                  //       : "7.5rem",
                });

                /// add column in excel
                aColumnConfig.push({
                  label: oData.label,
                  property: oData.property,
                });

                // add column to table
                oTable.addColumn(oColumn);
              }
            }

            const onAfterRendering = (_) => {
              let oTpc = null;
              if (sap.ui.table.TablePointerExtension) {
                oTpc = new sap.ui.table.TablePointerExtension(oTable);
              } else {
                oTpc = new sap.ui.table.extensions.Pointer(oTable);
              }
              const aColumns = oTable.getColumns();
              for (let i = aColumns.length; i >= 0; i--) {
                oTpc.doAutoResizeColumn(i);
              }
            };

            // add event delegate for onafter rendering
            oTable.addEventDelegate({
              onAfterRendering,
            });

            // table model
            oTable.setModel(new JSONModel(aItemDataFields));

            // if no entries hide the table
            oTable.setVisible(aItemDataFields.length !== 0);

            // table binding
            let oBindingInfo = oTable.getBindingInfo("rows");
            oTable.bindRows(
              oBindingInfo || {
                path: "/",
              }
            );

            // set visibility
            _oTableContainer.setVisible(true);

            // add item to aggregation
            _oTableContainer.addItem(oTable);

            // test import and import button properties
            let bEnableTestBtn = false;
            let bEnableImportBtn = false;

            // updates on get error index
            let aErrorRowIndex = [];

            // get error index
            const fnErrorRowIndex = () => {
              for (let [index, oData] of aItemDataFields.entries()) {
                if (oData[sStatusFieldProperty].toUpperCase() === "ERROR") {
                  aErrorRowIndex.push(index + 1);
                }
              }
            };

            // get error message
            const fnErrorMsg = () => {
              let sErrorMsgAction =
                sAction === "TestImport"
                  ? `Re-run the Test import to ensure there are no errors before Import.`
                  : `Upload valid data to Test Import.`;
              let sErrorIndexs = aErrorRowIndex.join(", ");

              sMessageText = `Kinldy fix the errors in below rows ${sErrorIndexs}.
  
                                  ${sErrorMsgAction}`;
            };

            // on upload action
            switch (sAction) {
              case "Report":
                break;
              case "Upload":
              case "ViewImportHistory":
                fnErrorRowIndex();
                sMessageText = `Your application data is ready for import will create ${aItemDataFields.length} new items.
  
                                      Please proceed to Test Import.`;
                // enable test import btn - if there are no errors
                bEnableTestBtn = aErrorRowIndex.length === 0;
                // disable import button
                bEnableImportBtn = false;
                break;
              case "TestImport":
                fnErrorRowIndex();
                sMessageText = `Test Import is successful, Import will create ${aItemDataFields.length} new items.
  
                                      Please proceed to Import.`;

                // disable test import btn if there are no erros
                bEnableTestBtn = aErrorRowIndex.length !== 0;
                // enable import btn - if there are no errors
                bEnableImportBtn = aErrorRowIndex.length === 0;
                break;
              case "Import":
                sMessageText = "Application data is created successfully.";
                // disable test import btn
                bEnableTestBtn = false;
                // disable import btn
                bEnableImportBtn = false;
                break;
              default:
                break;
            }

            // errors found
            if (aErrorRowIndex.length !== 0) {
              sMessageType = "Error";

              // fill error message
              fnErrorMsg();
            } else {
              sMessageType = "Success";
            }

            // enable download button
            var oDownloadBtn = sap.ui.getCore().byId("idDownloadResultsBtn");
            oDownloadBtn.setEnabled(true);

            bMessageVisible = sAction !== "Report";

            _oViewModel.setProperty("/btnImport", bEnableImportBtn);
            _oViewModel.setProperty("/action", sAction);
            _oViewModel.setProperty("/messageType", sMessageType);
            _oViewModel.setProperty("/messageText", sMessageText);
            _oViewModel.setProperty("/messageVisible", bMessageVisible);
            _oViewModel.setProperty("/btnTestImport", bEnableTestBtn);
          } catch (error) {
            // error in loading file
            MessageToast.show("Error " + error);
          }
        };

        const fnError = (oErrorResponse) => {
          // clear error messages
          this._initMessageStrips();
          let sMessage = "";

          if (oErrorResponse.statusCode === "400") {
            const oError = JSON.parse(oErrorResponse.responseText);
            sMessage = oError.error.message.value;
          } else {
            const oParser = new DOMParser();
            const oXmlDoc = oParser.parseFromString(
              oErrorResponse.responseText,
              "text/xml"
            );

            sMessage = oXmlDoc.getElementsByTagName("message")[0].innerHTML;
          }

          let sMessageType = "Error";
          const aSuccessMessage = [
            "Upload is running in Background,click import history to check progress",
            "No records exists",
          ];
          const aResponse = aSuccessMessage.filter(
            (element) => element === sMessage
          );

          if (aResponse.length > 0) {
            sMessageType = "Success";
          }

          _oViewModel.setProperty("/messageType", sMessageType);
          _oViewModel.setProperty("/messageText", sMessage);
          _oViewModel.setProperty("/messageVisible", true);

          // disable both buttons
          _oViewModel.setProperty("/btnTestImport", false);
          _oViewModel.setProperty("/btnImport", false);
        };

        // load filter data
        let aFilters = [];

        // load filters except view import history
        if (sAction !== "ViewImportHistory") {
          aFilters = this._getFilters();
        }

        // guid
        if (
          sAction === "ViewImportHistory" ||
          sAction === "Upload" ||
          sAction === "TestImport" ||
          sAction === "Import"
        ) {
          aFilters.push(new Filter("ID", FilterOperator.EQ, _sUuidUpload));
        }

        // condition type
        aFilters.push(
          new Filter(
            "ConditionType",
            FilterOperator.EQ,
            _oConditionTypeData.ConditionType
          )
        );

        // table name
        aFilters.push(
          new Filter(
            "TableName",
            FilterOperator.EQ,
            _oConditionTypeData.TableName.toString()
          )
        );

        // action name
        aFilters.push(new Filter("ActionName", FilterOperator.EQ, sAction));

        // read the fields of aggregation level using OData in JSON model
        _oDataModel.read("/ActionSet", {
          urlParameters: {
            $expand: "TableHeaderSet,TableItemSet",
          },
          filters: aFilters,
          success: fnSuccess,
          error: fnError,
        });
      },
    });
  }
);

/*
  let sURL =
      `/ActionSet(` +
          `ID='',` +
          `ConditionType='${_oConditionTypeData.ConditionType}',` +
          `TableName='${_oConditionTypeData.TableName}',` +
          `ActionName='',` +
          `SalesOrganization='${oParameters.SalesOrganization || ""}',` +
          `DistributionChannel='${oParameters.DistributionChannel || ""}',` +
          `CustomerNumber='${oParameters.CustomerNumber || ""}',` +
          `Payer='${oParameters.Payer || ""}',` +
          `SoldToParty='${oParameters.SoldToParty || ""}',` +
          `SalesDocumentType='${oParameters.SalesDocumentType || ""}',` +
          `MaterialNumber='${oParameters.MaterialNumber || ""}',` +
          `MaterialDivision='${oParameters.MaterialDivision || ""}',` +
          `VariantCondition='${oParameters.VariantCondition || ""}',` +
          `MaterialPriceGroup='${oParameters.MaterialPriceGroup || ""}',` +
          `CustomerGroup='${oParameters.CustomerGroup || ""}',` +
          `PriceListType='${oParameters.PriceListType || ""}',` +
          `ValidityFrom='${oParameters.ValidityFrom || ""}',` +
          `ValidityTo='${oParameters.ValidityTo || ""}',` +
          `DeletionInd='${oParameters.DeletionInd || ""}'` +
          `)`;
  */
