/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require(["oup/otc/pricingupload/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});
