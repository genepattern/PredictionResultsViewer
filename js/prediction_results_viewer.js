function loadOdfFile(pObj) {
    var odfURL = pObj['url'];
    var successCallback = pObj['success'];
    var errorCallback = pObj['error'];
    var gpLib = pObj['gpLib'];
    var headers = {};

    if (gpLib.isGenomeSpaceFile(odfURL)) {
        var requestParams = gpUtil.parseQueryString();

        if (requestParams["|gst"] !== undefined && requestParams["|gsu"] !== undefined) {
            headers = {
                "gs-token": requestParams["|gst"].join(),  //should only be one item
                "gs-username": requestParams["|gsu"].join()
            };
        }
    }

    gpLib.rangeRequestsAllowed(odfURL, {
        successCallBack: function(acceptRanges) {
            if(acceptRanges) {
                //get the third data row in order to get the sample names
                getOdfFileContentsUsingByteRequests(odfURL, -1, 0, 1000000, undefined, headers, successCallback, errorCallback);
            }
            else {
                gpLib.getDataAtUrl(odfURL, {
                    headers: headers,
                    successCallBack: successCallback,
                    failCallBack: errorCallback
                });
            }
        },
        failCallBack: function() {
            gpLib.getDataAtUrl(odfURL, {
                headers: headers,
                successCallBack: successCallback,
                failCallBack: errorCallback
            });
        }
    });
}

function getOdfFileContentsUsingByteRequests(fileURL, maxNumLines, startBytes, byteIncrement, fileContents, headers, successCallback, errorCallback) {
    if (fileContents != undefined) {
        cmsOdfContents = cmsOdfContents.concat(fileContents);
    }

    if (startBytes != undefined && startBytes != null && startBytes >= 0 && fileContents != "") {
        gpLib.readBytesFromURL(fileURL, maxNumLines, startBytes, byteIncrement, {
            headers: headers,
            successCallBack: getOdfFileContentsUsingByteRequests,
            failCallBack: errorCallback
        });

    }
    else {
        if (cmsOdfContents != undefined && cmsOdfContents != null && cmsOdfContents.length > 0) {
            successCallback(cmsOdfContents);
            cmsOdfContents = null;
        }
        else {
            errorCallback("data is empty");
        }
    }
}

function addTableData(data) {
    var table_div = $("#table-div");
    var tbody = table_div.find("tbody");

    // Loop
    for (var i = 0; data["Samples"].length > i; i++) {
        var sample = data["Samples"][i];
        var true_class = data["True Class"][i];
        var predicted_class = data["Predicted Class"][i];
        var confidence = Math.abs(data["Confidence"][i]);
        var correct = data["Correct?"][i] === "true" ? "Y" : "Error";

        var row = $("<tr>");

        row.append(
            $("<td></td>")
                .append(sample)
        );
        row.append(
            $("<td></td>")
                .append(true_class)
        );
        row.append(
            $("<td></td>")
                .append(predicted_class)
        );
        row.append(
            $("<td></td>")
                .append(confidence)
        );
        row.append(
            $("<td></td>")
                .append(correct)
        );

        tbody.append(row);
    }

    table_div.show();
}

function addMiddleData(data) {
    var absolute_error = (data["NumErrors"] / data["DataLines"]).toFixed(5) +
        "<br/>(Right " + data["NumCorrect"] + ", Wrong " + data["NumErrors"] + ")";
    var no_calls = data["DataLines"] - data["NumErrors"] - data["NumCorrect"];

    $("#absolute-error").append(absolute_error);
    $("#no-calls").append(no_calls);
    $("#roc-error").append(data[""]);
    $("#predictor").append(data["PredictorModel"]);
    $("#features").append(data["NumFeatures"]);

    var middle_div = $("#middle-div");
    middle_div.show();
}

function addPlotData(data, Plotly) {
    var layout = {
        xaxis: {
            showgrid: true,
            showline: true
        },
        yaxis: {
            title: "Confidence",
            showgrid: true,
            showline: true
        },
        margin: {
            l: 70,
            r: 10,
            b: 100,
            t: 10
        },
        legend: {
            font: {
                size: 10
            },
            y: 0.5,
            yref: 'paper'
        },
        height: 400,
        hovermode: 'closest'
    };

    // Create the data points by class
    var first_class_y = [];
    var second_class_y = [];
    var first_class_name = data["Classes"][0];
    for (var i = 0; i < data["Samples"].length; i++) {
        var true_class = data["True Class"][i];
        var confidence = data["Confidence"][i];
        if (true_class === first_class_name) {
            first_class_y.push(confidence);
            second_class_y.push(null);
        }
        else {
            first_class_y.push(null);
            second_class_y.push(confidence);
        }
    }

    var first_class = {
        x: data["Samples"],
        y: first_class_y,
        mode: 'markers',
        type: 'scatter',
        name: 'ALL'
    };

    var second_class = {
        x: data["Samples"],
        y: second_class_y,
        mode: 'markers',
        type: 'scatter',
        name: 'AML'
    };

    console.log(first_class_y);
    console.log(second_class_y);

    // Plot the data
    var plot_data = [first_class, second_class];
    Plotly.newPlot('plot-div', plot_data, layout);
    setTimeout(function() {
        $("#plot-div").find(".main-svg:first").css("height", 420);
    }, 10);
}

function processData(data) {
    var classes = new Set(data["True Class"].concat(data["Predicted Class"]));
    var class_list = Array.from(classes);

    // Confidence multipliers
    var pos = class_list[0];
    var neg = class_list[1];

    // Transform arrays into objects, negatively weight second class
    var sample_objects = [];
    for (var i = 0; data["Samples"].length > i; i++) {
        var predicted_class = data["Predicted Class"][i];

        sample_objects.push({
            "Samples": data["Samples"][i],
            "Confidence": predicted_class === neg ? (parseFloat(data["Confidence"][i]) * -1) : (parseFloat(data["Confidence"][i]) * 1),
            "Predicted Class": data["Predicted Class"][i],
            "True Class": data["True Class"][i],
            "Correct?": data["Correct?"][i] === "true" ? true : false
        });
    }

    // Sort objects by modified confidence
    sample_objects.sort(function(a, b) {
        if (a.Confidence < b.Confidence) return 1;
        if (a.Confidence > b.Confidence) return -1;
        return 0;
    });

    // Create new arrays and assign back to data
    var samples = [];
    var predicted_class = [];
    var true_class =[];
    var correct = []
    var confidence = [];
    for (var i = 0; sample_objects.length > i; i++) {
        var obj = sample_objects[i];
        samples.push(obj["Samples"]);
        predicted_class.push(obj["Predicted Class"]);
        true_class.push(obj["True Class"]);
        confidence.push(obj["Confidence"]);
        correct.push(obj["Correct?"]);
    }
    data["Samples"] = samples;
    data["Predicted Class"] = predicted_class;
    data["True Class"] = true_class;
    data["Correct"] = correct;
    data["Confidence"] = confidence;
    data["Classes"] = class_list;

    return data;
}

requirejs(["jquery", "plotly", "gp_util", "gp_lib", "DataTables/datatables.min", "jquery-ui", "js.cookie"],
    function($, Plotly, gpUtil, gpLib, datatables) {

    var requestParams = gpUtil.parseQueryString();

    // Verify necessary input
    if (requestParams["prediction.results.file"] === undefined) {
        // Show error message
        $("#error-message")
            .append("Required input <i>prediction.results.file</i> not defined.")
            .dialog();
        return;
    }

    var url = requestParams["prediction.results.file"][0];

    // Waiting screen

    // Load the prediction results ODF
    loadOdfFile({
        url: url,
        gpLib: gpLib,
        success: function(raw_data) {
            console.log(raw_data);

            // Parse the data
            var data = gpLib.parseODF(raw_data, "Prediction Results");
            console.log(data);

            // Process the data
            data = processData(data);

            // Assemble the plot
            addPlotData(data, Plotly);

            // Assemble the middle
            addMiddleData(data);

            // Assemble the table
            addTableData(data);
            $("#table-div table").DataTable();
        },
        error: function(message) {
            $("#error-message")
                .append("Failed to load data: " + message)
                .dialog();
        }
    });
});