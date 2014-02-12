rm -rf js/*
dojo/util/buildscripts/build.sh action=release --profile dojo/util/buildscripts/profiles/firmos.profile.js
node aloha/build/r.js -o aloha/build/aloha/build-profile-firmos.js
mkdir js/d3
cp d3/d3.min.js js/d3/d3.min.js
java -jar closure_compiler/compiler.jar --js js/d3/d3.min.js fre_js/configBuild.js js/aloha/lib/require.js js/aloha/lib/vendor/jquery-1.7.2.js js/aloha/lib/aloha.js fre_js/cleanup.js js/dojo/dojo/dojo.js fre_js/dojo_utils.js codemirror/lib/codemirror.js codemirror/mode/javascript/javascript.js codemirror/mode/pascal/pascal.js --js_output_file js/framework.js

# cat js/aloha/css/aloha.css codemirror/lib/codemirror.css > js/all.css
