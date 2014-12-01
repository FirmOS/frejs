// Script to process all the less files and convert them to CSS files
// Run from themes/dijit/claro like:
//
//	$ node compile.js

var fs = require('fs'),		// file system access
	path = require('path'),	// get directory from file name
	less = require(process.env.PWD+'/../../dojo/util/less');	// less processor

var options = {
	compress: true,
	optimization: 1,
	silent: false
};


/*
var allFiles = [].concat(
		fs.readdirSync(".")
	),
	lessFiles = allFiles.filter(function(name){ return name && name != "variables.less" && /\.less$/.test(name); });
*/
var lessFiles = [
  "document.less",
  "Common.less",
  "TabContainer.less",
  "AccordionContainer.less",
  "ContentPane.less",
  "BorderContainer.less",
  "firmosMultiContentContainer.less",
  "Button.less",
  "Checkbox.less",
  "RadioButton.less",
  "Select.less",
  "Slider.less",
  "NumberSpinner.less",
  "Dialog.less",
  "Calendar.less",
  "Menu.less",
  "ColorPalette.less",
  "InlineEditBox.less",
  "ProgressBar.less",
  "TimePicker.less",
  "Toolbar.less",
  "Editor.less",/*in order to test button or menu item with icon */
  "TitlePane.less",
  "skin.less",
  "SitemapSVG.less",
  "TopMenu.less",
  "dojoOverride.less",
  "firmos.less"
]

var all_css = "";
var files_processed = 0;

var dojo_path = process.env.PWD;
dojo_path = dojo_path.substring(0,dojo_path.lastIndexOf('/')); // ..
dojo_path = dojo_path.substring(0,dojo_path.lastIndexOf('/')); // ../..

var common_files = [
dojo_path+"/dojo/dojo/resources/dojo.css",
dojo_path+"/dojo/dijit/themes/dijit.css",
dojo_path+"/dojo/dojox/form/resources/CheckedMultiSelect.css",
dojo_path+"/dojo/dojox/form/resources/UploaderFileList.css",
dojo_path+"/dojo/dgrid/css/dgrid.css",
dojo_path+"/dojo/dijit/icons/commonIcons.css",
dojo_path+"/dojo/dijit/icons/editorIcons.css"
]

common_files.forEach(function(fname){
  console.log(fname);
  fs.readFile(fname, 'utf-8', function(e, data){
    if(e){
      console.error("lessc: " + e.message);
	  process.exit(3);
    }
    all_css = all_css + data;
    files_processed ++;
  });
});

lessFiles.forEach(function(fname){
	console.log("=== " + fname);
	fs.readFile(fname, 'utf-8', function(e, data){
		if(e){
			console.error("lessc: " + e.message);
			process.exit(1);
		}

		new(less.Parser)({
			paths: [path.dirname(fname)],
			optimization: options.optimization,
			filename: fname
		}).parse(data, function(err, tree){
			if(err){
				less.writeError(err, options);
				process.exit(1);
			}else{
				try{
					var css = tree.toCSS({ compress: options.compress }),
						outputFname = fname.replace('.less', '.css');
					all_css = all_css + css;
					var fd = fs.openSync(outputFname, "w");
					fs.writeSync(fd, css, 0, "utf8");
					files_processed ++;
				}catch(e){
					less.writeError(e, options);
					process.exit(2);
				}
			}
		});
	});
});

function writeAllCss() {
  if (files_processed!=(lessFiles.length+common_files.length)) {
    setTimeout(writeAllCss,10); //wait until all files are read
  } else {
    try{
      var fd = fs.openSync('all.css', "w");
      fs.writeSync(fd, all_css, 0, "utf8");
    }catch(e){
      less.writeError(e, options);
      process.exit(2);
    }
  }
}

writeAllCss();

