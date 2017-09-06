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
                gpLib.getDataAtUrl(odfURL, {
                    headers: headers,
                    successCallBack: successCallback,
                    failCallBack: errorCallback
                });
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

function callLabel(correct, confidence, callThreshold) {
    if (confidence < callThreshold) return "No Call";
    return correct === "true" ? "Y" : "Error";
}

function addTableData(data, callThreshold) {
    var table_div = $("#table-div");
    var tbody = table_div.find("tbody");

    // Loop
    for (var i = 0; data["Samples"].length > i; i++) {
        var sample = data["Samples"][i];
        var true_class = data["True Class"][i];
        var predicted_class = data["Predicted Class"][i];
        var confidence = Math.abs(data["Confidence"][i]);
        var correct = callLabel(data["Correct?"][i], confidence, callThreshold);

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

function addMiddleData(data, Plotly) {
    // Build the confusion matrix
    var class1 = data["Classes"][0];
    var class2 = data["Classes"][1];
    $("#predicted-1").text("Predicted " + class1);
    $("#predicted-2").text("Predicted " + class2);
    $("#true-1").text("True " + class1);
    $("#true-2").text("True " + class2);

    var samples = data["Samples"].length;
    var trues = [0, 0];
    var errors = [0, 0];
    var class1_count = 0;
    var class2_count = 0;
    for (var i = 0; i < samples; i++) {
        var predicted_class = data["Predicted Class"][i];
        var true_class = data["True Class"][i];
        if (predicted_class === true_class) {
            // True
            predicted_class === class1 ? trues[0]++ : trues[1]++;
        }
        else {
            // Error
            predicted_class === class1 ? errors[0]++ : errors[1]++;
        }
        true_class === class1 ? class1_count++ : class2_count++;
    }
    $("#predicted-1-true-1").text((trues[0] / class1_count).toFixed(5) + " (" + trues[0] + ")");
    $("#predicted-2-true-2").text((trues[1] / class2_count).toFixed(5) + " (" + trues[1] + ")");
    $("#predicted-1-true-2").text((errors[1] / class1_count).toFixed(5) + " (" + errors[1] + ")");
    $("#predicted-2-true-1").text((errors[0] / class2_count).toFixed(5) + " (" + errors[0] + ")");

    var absolute_error = (data["NumErrors"] / data["DataLines"]).toFixed(5) +
        "<br/>(Right " + data["NumCorrect"] + ", Wrong " + data["NumErrors"] + ")";
    var roc_error = (((errors[1]/(errors[1] + trues[0])) + (errors[0]/(errors[0] + trues[1]))) / 2).toFixed(5);

    $("#absolute-error").append(absolute_error);
    $("#no-calls").append("0.00000 (0 skipped)");
    $("#roc-error").append(roc_error);
    $("#predictor").append(data["PredictorModel"]);
    $("#features").append(data["NumFeatures"]);

    $("#update-button").click(function() {
        var threshold = $("#threshold-value").val();
        addPlotData(data, Plotly, threshold);
        updateTable(data, threshold);
    });

    var middle_div = $("#middle-div");
    middle_div.show();
}

function updateTable(data, threshold) {
    var table_div = $("#table-div");
    var tbody = table_div.find("tbody");
    var rows = tbody.find("tr");
    var no_calls = 0;
    var total = 0;
    var correct = 0;
    var error = 0;

    var class1 = data["Classes"][0];
    var class2 = data["Classes"][1];
    var trues = [0, 0];
    var errors = [0, 0];
    var class1_count = 0;
    var class2_count = 0;

    rows.each(function(i, e) {
        var cells = $(e).find("td");
        var true_class = $(cells[1]).text();
        var predicted_class = $(cells[2]).text();
        var confidence = parseFloat($(cells[3]).text());
        total++;

        if (confidence < threshold) {
            $(cells[4]).text("No Call");
            no_calls++;
        }
        else {
            var is_correct = true_class === predicted_class;
            if (is_correct) correct++;
            else error++;
            var label = is_correct ? "Y" : "Error";
            $(cells[4]).text(label);

            // Confusion Matrix stuff
            if (predicted_class === true_class) {
                // True
                predicted_class === class1 ? trues[0]++ : trues[1]++;
            }
            else {
                // Error
                predicted_class === class1 ? errors[0]++ : errors[1]++;
            }
            true_class === class1 ? class1_count++ : class2_count++;
            }
    });

    $("#no-calls").text((no_calls / total).toFixed(5) + " (" + no_calls + " skipped)");
    $("#absolute-error").text((error / (correct + error)).toFixed(5) + " (" + correct + " Right, " + error + " Wrong)");

    $("#predicted-1-true-1").text((trues[0] / class1_count).toFixed(5) + " (" + trues[0] + ")");
    $("#predicted-2-true-2").text((trues[1] / class2_count).toFixed(5) + " (" + trues[1] + ")");
    $("#predicted-1-true-2").text((errors[1] / class1_count).toFixed(5) + " (" + errors[1] + ")");
    $("#predicted-2-true-1").text((errors[0] / class2_count).toFixed(5) + " (" + errors[0] + ")");

    var roc_error = (((errors[1]/(errors[1] + trues[0])) + (errors[0]/(errors[0] + trues[1]))) / 2).toFixed(5);
    $("#roc-error").text(roc_error);
}

function addPlotData(data, Plotly, callThreshold) {
    $("#plot-div").empty();

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
        height: 350,
        hovermode: 'closest'
    };

    var config = {
        displayModeBar: false,
        modeBarButtonsToRemove: ['sendDataToCloud', 'zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'hoverClosestCartesian', 'hoverCompareCartesian', 'autoScale2d', 'resetScale2d'],
        displaylogo: false,
        showTips: true
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

    var call_threshold_pos = {
        x: [data["Samples"][0], data["Samples"][data["Samples"].length-1]],
        y: [callThreshold, callThreshold],
        mode: 'lines',
        type: 'scatter',
        name: 'Call Threshold',
        line: {
            color: 'rgb(0, 128, 0)',
            width: 1
        }
    };

    var call_threshold_neg = {
        x: [data["Samples"][0], data["Samples"][data["Samples"].length-1]],
        y: [callThreshold * -1, callThreshold * -1],
        mode: 'lines',
        type: 'scatter',
        name: 'Call Threshold',
        line: {
            color: 'rgb(0, 128, 0)',
            width: 1
        },
        showlegend: false
    };

    console.log(first_class_y);
    console.log(second_class_y);

    // Plot the data
    var plot_data = [first_class, second_class, call_threshold_pos, call_threshold_neg];
    Plotly.newPlot('plot-div', plot_data, layout, config);
    setTimeout(function() {
        var plotSVG = $("#plot-div").find(".main-svg:first");
        plotSVG.attr("height", 425);
        plotSVG.css("height", 425);
        plotSVG.parent().css("height", 400);
        addDownloadButton();
    }, 10);
}

function addDownloadButton() {
    var plotDiv = $("#plot-div");

    // Add the button
    var downloadButton = $('<button><i class="fa fa-download" aria-hidden="true"></i> PNG</button>')
        .css("position", "absolute")
        .css("right", 10)
        .css("z-index", 64000)
        .click(function() {
            var svg = $("#plot-div").find(".main-svg:first")[0];
            var canvas = document.getElementById('download-canvas');
            var ctx = canvas.getContext('2d');
            var data = (new XMLSerializer()).serializeToString(svg);
            var DOMURL = window.URL || window.webkitURL || window;

            var img = new Image();
            var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
            var url = DOMURL.createObjectURL(svgBlob);

            canvas.width = 1300;
            canvas.height = 475;

            img.onload = function () {
                ctx.drawImage(img, 0, 0);
                DOMURL.revokeObjectURL(url);

                var imgURI = canvas
                    .toDataURL('image/png')
                    .replace('image/png', 'image/octet-stream');

                triggerDownload(imgURI);
            };

            img.src = url;
        });
    plotDiv.prepend(downloadButton);

    // Add the canvas
    var downloadCanvas = $('<canvas></canvas>')
        .attr("id", "download-canvas")
        .css("width", $(document).width() - 150)
        .css("height", 550)
        .hide();
    plotDiv.append(downloadCanvas);
}

function triggerDownload (imgURI) {
    var evt = new MouseEvent('click', {
        view: window,
        bubbles: false,
        cancelable: true
    });

    var a = document.createElement('a');
    a.setAttribute('download', 'PredictionResults.png');
    a.setAttribute('href', imgURI);
    a.setAttribute('target', '_blank');

    a.dispatchEvent(evt);
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

    // Load the prediction results ODF
    loadOdfFile({
        url: url,
        gpLib: gpLib,
        success: function(raw_data) {
            // Parse the data
            var data = gpLib.parseODF(raw_data, "Prediction Results");

            // Process the data
            data = processData(data);

            // Hide the loading screen
            $("#loading").hide();

            // Assemble the plot
            addPlotData(data, Plotly, 0);

            // Assemble the middle
            addMiddleData(data, Plotly);
            $("#confusion-matrix").DataTable({
                "paging":   false,
                "ordering": false,
                "info":     false,
                "filter":   false
            });

            // Assemble the table
            addTableData(data, 0);
            $("#table-div table").DataTable({
                "pageLength": 50
            });
        },
        error: function(message) {
            $("#loading").hide();
            $("#error-message")
                .append("Failed to load data: " + message)
                .dialog();
        }
    });
});