/*
 * Depends on the jQuery, jQuery UI, and the Javascript Cookie plugins
 */
var gpAuthorizationHeaders = {};

var gpLib = function($, jqueryui, cookie) {

    $(function() {
        //setup the global Authorization token
        var token = window.location.hash;
        if(token !== undefined && token !== null && token.length > 0)
        {
            token = token.substring(1);
            $.ajaxSetup({
                headers: {},
                beforeSend: async function(xhr, settings) {
                    if (!!window.location.hash) {
                        const response = await fetch(settings.url, {
                            method: 'HEAD',
                            cache: 'no-cache',
                            mode: 'cors',
                            credentials: 'include',
                            headers: {
                                'Authorization': 'Bearer ' + token
                            },
                            redirect: 'follow'
                        });

                        if (!response.headers.has('x-amz-request-id')) // If not an S3 redirect, attach the authorization header
                            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                    }
                }
            });
        }
    });

    /**
     * Uploads a file to the GP Files Tab
     * @param url - the url of the file on the GP server
     * @param data - the contents of the file
     * @param callBack - a callback function if the upload was successful
     */
    function uploadDataToFilesTab(url, data, callBack) {
        var uploadData = new Blob(data, {type: 'text/plain'});

        $.ajax({
            type: "POST",
            processData: false,
            contentType: false,
            data: uploadData,
            url: "/gp/rest/v1/upload/whole/?path=" + encodeURIComponent(url),
            success: function () {
                console.log("upload complete");

                if (callBack !== undefined) {
                    callBack("success");
                }
            },
            error: function (data, textStatus) {
                console.log("Error: " + textStatus);
                callBack("Error: " + textStatus)
            }
        });
    }

    function downloadFile(fileName, contents)
    {
        var blob = new Blob([ contents ], {
            type : "text/plain;charset=utf-8"
        });

        saveAs(blob, fileName);
    }

    /**
     * This function displays a dialog displaying the directories in the Files Tab for the current GP user
     * @param callBack - a callback function if a directory in the Files Tab was selected
     */
    function saveFileDialog(contents, extension, defaultFileName, callBack)
    {
        if(defaultFileName === undefined || defaultFileName === null)
        {
            defaultFileName = "";
        }

        //create dialog
        w2popup.open({
            title: 'Save File',
            width: 450,
            height: 380,
            showMax: true,
            modal: true,
            body: '<div id="gpDialog" style="margin: 14px 15px 2px 15px;"><label>File name: <input type="text" value="' + defaultFileName + '"id="fileName" style="width: 250px;"/>' +
                '</label><div style="margin: 8px 8px 8px 2px;"><input name="saveMethod" value="gp" type="radio" checked="checked" style="margin-right: 5px"/>Save To GenePattern' +
                '<input name="saveMethod" type="radio" value="download"/>Download</div>' +
                '<div id="gpSave">Select save location:<br/><div id="fileTree" style="height: 200px;border:2px solid white"/></div> </div>',
            buttons: '<button id="cancelSaveToGPBtn" class="btn" onclick="w2popup.close();">Cancel</button> ' +
                '<button id="saveToGPBtn" class="btn" disabled="disabled">OK</button>',
            onOpen: function (event) {
                event.onComplete = function () {
                    $("input[name='saveMethod']").click(function()
                    {
                        var checkedValue = $(this).filter(':checked').val();
                        if(checkedValue == "gp")
                        {
                            $("#gpSave").show();
                            $("#saveToGPBtn").prop( "disabled", true );
                        }
                        else
                        {
                            $("#saveToGPBtn").prop( "disabled", false );

                            $("#gpSave").hide();
                        }
                    });

                    $("#fileTree").gpUploadsTree(
                    {
                        name: "Uploads_Tab_Tree",
                        onChange: function(directory)
                        {
                            //enable the OK button if a directory was selected
                            if(directory != undefined && directory.url.length > 0)
                            {
                                $("#saveToGPBtn").prop( "disabled", false );
                            }
                        }
                    });
                };
            }
        });

        $("#saveToGPBtn").click(function(event)
        {
            var selectedGpDirObj = $("#fileTree").gpUploadsTree("selectedDir");
            var saveMethod = $("input[name='saveMethod']:checked").val();
            var fileName = $("#fileName").val();

            if(extension != undefined && !gpUtil.endsWith(fileName, extension))
            {
                fileName += extension;
            }
            var result = "success";
            $("#fileTree").gpUploadsTree("destroy");

            //save the file either to GenePattern or locally
            if(saveMethod == "gp")
            {
                var text = [];
                text.push(contents);

                var saveLocation = selectedGpDirObj.url + fileName;
                console.log("save location: " + saveLocation);
                uploadDataToFilesTab(saveLocation, text, function(result)
                {
                    if(result !== "success")
                    {
                        w2alert("Error saving file. " + result, 'File Save Error');
                    }
                    else
                    {
                        w2alert("File " + fileName + " saved.", 'File Save' );
                    }
                });
            }
            else
            {
                downloadFile(fileName, contents);
            }

            if($.isFunction(callBack))
            {
                callBack(result);
            }

            w2popup.close();
        });
    }

    /**
     * This function displays a dialog displaying the directories in the Files Tab for the current GP user
     * @param callBack - a callback function if a directory in the Files Tab was selected
     */
    function browseFilesTab(callBack) {
        //create dialog
        w2popup.open({
            title: 'Select Directory from Files Tab',
            width: 600,
            height: 320,
            showMax: true,
            modal: true,
            body: '<div id="gpDialog"><div id="fileTree" style="height: 300px;"/></div>',
            buttons: '<button class="btn" onclick="w2popup.close();">Cancel</button> <button class="btn" onclick="w2popup.close();">OK</button>',
            onOpen: function (event) {
                event.onComplete = function () {
                    $("#fileTree").gpUploadsTree(
                        {
                            name: "Uploads_Tab_Tree"
                        });
                };
            },
            onClose: function (event) {
                var selectGpDir = $("#fileTree").gpUploadsTree("selectedDir");
                event.onComplete = function () {
                    $("#fileTree").gpUploadsTree("destroy");
                    callBack(selectGpDir);
                }
            }
        });
    }

    /**
     * Parses a gct file into an object
     * @param fileContents = the contents of the file
     */
    function parseGCTFile(fileContents)
    {
        var data = {
            sampleNames: [],
            rowNames: [],
            rowDescriptions: [],
            matrix: [[]]
        };
        var lines = fileContents.split(/\r\n|\r|\n/); //fileContents.split(/\r|\n/);

        if(lines.length >= 4 && lines[0].indexOf("#1.2") != -1)
        {
            //The samples
            var sampleLines = lines[2];
            var samples = sampleLines.split(/\t/);
            samples.splice(0, 2);
            data.sampleNames = samples;

            //the data starts on line 4 for a gct file
            for(var r=3;r<lines.length;r++)
            {
                var rowData = lines[r].split(/\t/);
                data.rowNames.push(rowData[0]);
                data.rowDescriptions.push(rowData[1]);
                data.matrix[r-3] = rowData.slice(2).map(Number);
            }
        }
        else
        {
            throw new Error("Error parsing data: Unexpected number of lines " + lines.length + ".");
        }

        return data;
    }

    function parseODF(fileContents, modelType)
    {
        var data = {};

        var lines = fileContents.split(/\r|\n/);

        if(lines.length < 2)
        {
            throw new Error("Error parsing ODF file. Unexpected number " +
                "of lines: " + lines.length);
        }

        //get the number of header lines
        var headerLine = lines[1].split('=');

        if(headerLine.length < 2)
        {
            throw new Error("Error parsing header line : " + lines[1]);
        }

        var numHeaderLines = parseInt(headerLine[1]);
        data[headerLine[0]] = numHeaderLines;

        for(var r=2;r<numHeaderLines+2; r++)
        {
            var headerRow = lines[r].split("=");

            if(headerRow.length > 1)
            {
                data[headerRow[0]] = headerRow[1];
            }
            else
            {
                //then assume the value is a list instead of a String
                headerRow = lines[r].split(":");

                if(headerRow.length > 1)
                {
                    var list = headerRow[1].trim().split(/\t/);
                    data[headerRow[0]] = list;
                }
            }
        }

        //Now check that this is a CMS ODF file
        if(data["Model"].length === 0 || data["Model"].trim() !== modelType)
        {
            throw new Error("Invalid ODF model. Found " + data["Model"] + " but expected " + modelType);
        }

        //Now parse the data lines
        if(data["DataLines"].length > 0)
        {
            var numDataRows = parseInt(data["DataLines"]);

            var startRow = numHeaderLines + 2;
            for(var n=startRow; n < numDataRows + startRow; n++)
            {
                var dataRow = lines[n].split(/\t/);

                var numColumns = dataRow.length;

                if(numColumns !== data["COLUMN_NAMES"].length)
                {
                    throw new Error("Unexpected number of data columns found on line " + n+". Expected "
                    +   data["COLUMN_NAMES"].length + " but found " +  + dataRow.length  + ".");
                }

                if(numColumns !== data["COLUMN_TYPES"].length)
                {
                    throw new Error("Unexpected number of data column types found. Expected "
                     + data["COLUMN_TYPES"].length +  " but found " + numColumns + ".");
                }

                for(var c=0;c < numColumns; c++)
                {
                    var columnName = data["COLUMN_NAMES"][c];

                    var columnData = data[columnName];

                    if(columnData === undefined)
                    {
                        columnData = [];
                    }

                    var dataValue = dataRow[c];
                    if(data["COLUMN_TYPES"][c] === "int")
                    {
                        dataValue = parseInt(dataValue);
                    }

                    if(data["COLUMN_TYPES"][c] === "double")
                    {
                        dataValue = parseFloat(dataValue);
                    }

                    columnData.push(dataValue);
                    data[columnName] = columnData;
                }
            }
        }

        return data;
    }

    function isGenomeSpaceFile(fileUrl)
    {
        var parser = $('<a/>');
        parser.attr("href", fileUrl);

        if(parser[0].hostname.indexOf("genomespace.org") != -1)
        {
            return true;
        }

        return false;
    }

    /**
     * Retrieves the contents of a file from a URL
     * @param fileURL
     * @param options - can contain request headers, a success callback function
     *                  and a failure callback function
     */
    function getDataAtUrl(fileURL, options)
    {
        //if the URL is an ftp url then fail
        if(fileURL.indexOf("ftp://") ===0)
        {
            var errorMsg = "FTP files are not supported.";
            if($.isFunction(options.failCallBack)) {
                options.failCallBack(errorMsg);
            }
            throw new Error(errorMsg);
        }

        var credentials = false;
        if(fileURL.indexOf("https://") === 0)
        {
            credentials = true;
        }

        if(options == undefined)
        {
            options = {
                headers: {}
            };
        }

        $.extend(options.headers, gpAuthorizationHeaders);

        $.ajax({
            contentType: null,
            url: fileURL,
            headers: options.headers,
            xhrFields: {
                withCredentials: credentials
            },
            crossDomain: true
        }).done(function (response, status, xhr) {
            if($.isFunction(options.successCallBack))
            {
                options.successCallBack(response);
            }
        }).fail(function (response, status, xhr)
        {
            console.log(response.statusText);
            if($.isFunction(options.failCallBack))
            {
                options.failCallBack(response.statusText, response);
            }
        });
    }

    /*
     * Logs an action the Broad Institute AppLogger REST Service
     */
    function logToAppLogger(application, action, entity, user, successCallBack, failCallBack) {
        if (user == undefined || user.length == 0) {
            user = "anonymous";
        }

        if (application == undefined || application.length == 0) {
            w2alert("An application must be specified");
            return;
        }

        if (entity == undefined || entity.length == 0) {
            w2alert("An entity must be specified");
            return;
        }

        if (action == undefined || action.length == 0) {
            w2alert("An action must be specified");
            return;
        }

        var usageObj = {
            usage: {
                application: application,
                user: user,
                entity: entity,
                action: action
            }
        };

        var logActivity = function (successCallBack, failCallBack){
            $.ajax({
                method: "POST",
                url: "http://vcapplog:3000/usages",
                contentType: "application/json",
                data: JSON.stringify(usageObj),
                dataType: "json",
                crossDomain: true
            }).done(function (response, status, xhr) {
                if ($.isFunction(successCallBack)) {
                    successCallBack(response);
                }
            }).fail(function (response, status, xhr) {
                console.log(response.statusText);
                if ($.isFunction(failCallBack)) {
                    failCallBack(response);
                }
            });
        };

        var ipAddress = Cookies.get('ipAddress');
        if(ipAddress === undefined || (ipAddress !== null && ipAddress.length == 0))
        {
            var failCallBack = function()
            {
                Cookies.set("ipAddress", "Not found");
            };

            logActivity(null, failCallBack);

            //disabling for now
            /*$.get("http://ipinfo.io", function (response)
            {
                var ipAddress = "";
                if (response !== undefined && response.ip !== undefined)
                {
                    usageObj.usage["ip_address"]  = response.ip;
                    ipAddress = response.ip;
                }

                Cookies.set("clientIpAddress", ipAddress);
            }, "jsonp").always(function()
            {
                logActivity(null, failCallBack);
            });*/
        }
        else
        {
            logActivity(null, failCallBack);
        }
    }

    function rangeRequestsAllowed(fileURL, options)
    {
        //if the URL is an ftp url then fail
        if(fileURL.indexOf("ftp://") === 0)
        {
            var errorMsg = "FTP files are not supported.";
            if($.isFunction(options.failCallBack)) {
                options.failCallBack(errorMsg);
            }
            throw new Error(errorMsg);
        }
        var credentials = false;
        if(fileURL.indexOf("https://") === 0)
        {
            credentials = true;
        }

        if(options === undefined)
        {
            options = {};
        }

        if(options.headers === undefined)
        {
            options.headers =  {}
        }

        $.extend(options.headers, gpAuthorizationHeaders);

        $.ajax({
            contentType: null,
            method: "HEAD",
            url: fileURL,
            headers: options.headers,
            xhrFields: {
                withCredentials: credentials
            },
            crossDomain: true
        }).done(function (response, status, xhr)
        {
            var allowRangeRequests = false;
            var acceptRanges = xhr.getResponseHeader("Accept-Ranges");
            if(acceptRanges === "bytes")
            {
                allowRangeRequests = true;
            }

            // Hack for range requests failing in Chrome
            if (isChrome()) allowRangeRequests = false;

            if($.isFunction(options.successCallBack))
            {
                options.successCallBack(allowRangeRequests, response);
            }
        }).fail(function (response, status, xhr)
        {
            if($.isFunction(options.failCallBack))
            {
                options.failCallBack(response.statusText, response);
            }
        });
    }

    function isChrome() {
        // please note,
        // that IE11 now returns undefined again for window.chrome
        // and new Opera 30 outputs true for window.chrome
        // and new IE Edge outputs to true now for window.chrome
        // and if not iOS Chrome check
        // so use the below updated condition
        var isChromium = window.chrome,
            winNav = window.navigator,
            vendorName = winNav.vendor,
            isOpera = winNav.userAgent.indexOf("OPR") > -1,
            isIEedge = winNav.userAgent.indexOf("Edge") > -1,
            isIOSChrome = winNav.userAgent.match("CriOS");

        if(isIOSChrome){
           // is Google Chrome on IOS - actually Safari wrapped in a Chrome skin
            return false;
        }
        else if(isChromium !== null && isChromium !== undefined && vendorName === "Google Inc." && isOpera == false && isIEedge == false) {
           // is Google Chrome
            return true;
        }
        else {
           // not Google Chrome
            return false;
        }
    }

    function readBytesFromURL(fileURL, maxNumLines, byteStart, byteIncrement, options)
    {
        if(byteStart === undefined || byteStart === null || byteStart === "")
        {
            throw Error("No starting byte specified for range request");
        }

        if(byteStart < 0)
        {
            throw Error("Invalid starting byte specified for range request: " + byteStart);
        }

        //if the URL is an ftp url then fail
        if(fileURL.indexOf("ftp://") === 0)
        {
            var errorMsg = "FTP files are not supported.";
            if($.isFunction(options.failCallBack)) {
                options.failCallBack(errorMsg);
            }
            throw new Error(errorMsg);
        }

        var credentials = false;
        if(fileURL.indexOf("https://") === 0)
        {
            credentials = true;
        }

        if(options === undefined)
        {
            options = {};
        }

        if(options.headers === undefined)
        {
            options.headers =  {};
        }

        var byteEnd = "";
        //if no byte increment is specified then default to +1000000 bytes from start
        if(byteIncrement === undefined || byteIncrement === null)
        {
            byteIncrement = 1000000;
        }

        //byteIncrement is empty then do not set an ending byte range
        if(byteIncrement != "")
        {
            byteEnd = byteStart + byteIncrement;
        }

        //get all bytes since max is not specified
        if(byteEnd == -1)
        {
            byteEnd = "";
        }

        //Just in case byte range requests are allowed
        if(options.headers.Range == undefined)
        {
            $.extend(options.headers, {"Range" : "bytes=" + byteStart + "-" + byteEnd});
        }

        $.extend(options.headers, gpAuthorizationHeaders);

        $.ajax({
            contentType: null,
            url: fileURL,
            headers: options.headers,
            xhrFields: {
                withCredentials: credentials
            },
            crossDomain: true
        }).done(function (response, status, xhr) {
            if($.isFunction(options.successCallBack))
            {
                byteStart = byteEnd + 1;

                var contentRange = xhr.getResponseHeader("Content-Range");
                var result = contentRange.split("/");

                byteEnd = byteStart + byteIncrement;
                if(result.length >= 2)
                {
                    var length = parseInt(result[1]);
                    if(byteEnd > length)
                    {
                        byteEnd = length-1;
                    }

                    if(byteStart > length)
                    {
                        byteStart = -1;
                        byteEnd = -1;
                    }
                }
                options.successCallBack(fileURL, maxNumLines, byteStart, byteIncrement, response);
            }
        }).fail(function (response, status, xhr)
        {
            console.log(response.statusText);
            if($.isFunction(options.failCallBack))
            {
                options.failCallBack(response.statusText, response);
            }
        });
    }

    // declare 'public' functions
    return {
        uploadDataToFilesTab:uploadDataToFilesTab,
        browseFilesTab: browseFilesTab,
        saveFileDialog: saveFileDialog,
        getDataAtUrl: getDataAtUrl,
        parseGCTFile: parseGCTFile,
        parseODF: parseODF,
        isGenomeSpaceFile: isGenomeSpaceFile,
        logToAppLogger: logToAppLogger,
        rangeRequestsAllowed: rangeRequestsAllowed,
        readBytesFromURL: readBytesFromURL
    };
};

define(["jquery", "jquery-ui", "js.cookie"], gpLib);