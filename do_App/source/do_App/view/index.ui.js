/*******************************************************************************
 * Author :and TimeStamp :2015-10-26
 ******************************************************************************/
var nf = sm("do_Notification");
// //
var page = sm("do_Page");
var close = ui("close");
close.on("touch", function() {
	app.closePage();
})
page.on("back", function(data) {
	app.closePage();
})
// //
var code = ui("code");
code.on("touch", function() {
	app.openPage({
		source : "source://do_App/view/codeviewer/index.ui",
		statusBarState : "transparent"
	});
});
// //
var listview = ui("listview");
var listdata = mm("do_ListData");

listdata.addData([ {
	"index" : "1",
	"name" : "update函数实现应用内升级"
}, {
	"index" : "2",
	"name" : "closePage和closePageToID函数"
}, {
	"index" : "3",
	"name" : "openPage状态栏参数设置"
} , {
	"index" : "4",
	"name" : "openPage动画样式展示"
} ]);
listview.bindItems(listdata);

var root = ui("$");
var app = sm("do_App");
listview.on("touch", function(index) {
	switch (index) {
	case 0:
		app.openPage({
			source : "source://do_App/view/update/index.ui",
			statusBarState : "transparent"
		});
		break;
	case 1:
		app.openPage({
			source : "source://do_App/view/closepage/page1.ui",
			statusBarState : "transparent",
			id : "page1_id" // 表示page1.ui的id为page1_id
		});
		break;
	case 2:
		app.openPage({
			source : "source://do_App/view/openpage_statusbar/index.ui",
			statusBarState : "transparent",
		});
		break;
	case 3:
		app.openPage({
			source : "source://do_App/view/open_animation/index.ui",
			statusBarState : "transparent",
		});
		break;
	}
});