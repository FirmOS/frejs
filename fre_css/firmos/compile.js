// Script to process all the less files and convert them to CSS files
// Run from themes/dijit/claro like:
//
//	$ node compile.js

var fs = require('fs'),		// file system access
	path = require('path'),	// get directory from file name
	less = require('../../dojo/util/less');	// less processor

var options = {
	compress: true,
	optimization: 1,
	silent: false
};


var allFiles = [].concat(
		fs.readdirSync("."),
		fs.readdirSync("form").map(function(fname){ return "form/"+fname; }),
		fs.readdirSync("layout").map(function(fname){ return "layout/"+fname; }),
		fs.readdirSync("dgrid").map(function(fname){ return "dgrid/"+fname; }),
		fs.readdirSync("dojox/widget/Calendar").map(function(fname){ return "dojox/widget/Calendar/"+fname; })
	),
	lessFiles = allFiles.filter(function(name){ return name && name != "variables.less" && /\.less$/.test(name); });

var all_css = "";
var files_processed = 0;

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
  if (files_processed!=lessFiles.length) {
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

