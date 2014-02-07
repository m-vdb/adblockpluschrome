/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

var SELECTOR_GROUP_SIZE = 20;

var elemhideElt = null;

var JOB_URL = "https://w4u-lerignoux.work4labs.com/w4d/pimpmyapp/get_user_job/";
var JOB_TEMPLATE = [
    '<div style="max-width: 500px">',
    '<div class="pimpmy">',
    '<div class="header">',
    '<h3>Suggested Job</h3>',
    '<p class="close">X</p>',
    '</div>',
    '<div class="content">',
    '<h2><a href="{{job_url}}">{{job_title}}</a></h2>',

    '<ul class="icons">',
    '<li>',
    '<img class="ico-company" src="">',
    '<p class="company">{{job_company}}</p>',
    '</li>',
    '<li>',
    '<img class="ico-contract" src="">',
    '<p class="contract">{{job_contract}}</p>',
    '</li>',
    '<li>',
    '<img class="ico-location" src="">',
    '<p class="location">{{job_location}}</p>',
    '</li>',
    '</ul>',

    '</div>',
    '<div class="actions">',
    // apply
    '<button data-action="apply" class="btn" data-container="body" data-toggle="popover"',
    'data-placement="bottom" data-html="true"',
    'data-content="<div data-jobapplied=\'{{job_id}}\' class=\'popover-action\' data-poped><form><input type=\'text\' data-email ',
    'placeholder=\'Enter your email\'/><input type=\'text\' data-linkedin placeholder=\'Link to your LinkedIn profile\'/>',
    '<button type=\'button\' class=\'btn\' data-action=\'doApply\'>Apply</button></form></div>" data-html="true">Apply</button>',
    // refer
    '<button data-action="refer" class="recommend" data-container="body" data-toggle="popover"',
    'data-placement="bottom" data-html="true"',
    'data-content="<div data-poped data-jobrefered=\'{{job_id}}\' class=\'popover-action\'><form><input type=\'text\' data-fromemail ',
    'placeholder=\'Your email\'/><input type=\'text\' data-friendemail placeholder=\'Friend email\'/><button type=\'button\'',
    'class=\'btn\' data-action=\'doRefer\'>Recommend</button></form></div>" data-html="true">Recommend</button>',
    '<span data-jobid="{{job_id}}"></span>',
    '</div>',
    '</div>',
    '</div>'
].join("");

var DESC_LIMIT = 150;
var TITLE_LIMIT = 30;
var CREATE_USER_URL = "https://w4u-lerignoux.work4labs.com/w4d/pimpmyapp/create_user";
var JOB_APPLY_URL = "https://w4u-lerignoux.work4labs.com/w4d/pimpmyapp/apply_job/";
var JOB_REFER_URL = "https://w4u-lerignoux.work4labs.com/w4d/pimpmyapp/refer_job/";
var MAX_SIZE = 450;
var MIN_SIZE = 150;

// Sets the currently used CSS rules for elemhide filters
function setElemhideCSSRules(selectors)
{
  if (elemhideElt && elemhideElt.parentNode)
    elemhideElt.parentNode.removeChild(elemhideElt);

  if (!selectors)
    return;

  elemhideElt = document.createElement("style");
  elemhideElt.setAttribute("type", "text/css");

  // Try to insert the style into the <head> tag, inserting directly under the
  // document root breaks dev tools functionality:
  // http://code.google.com/p/chromium/issues/detail?id=178109
  (document.head || document.documentElement).appendChild(elemhideElt);

  var elt = elemhideElt;  // Use a local variable to avoid racing conditions
  function setRules()
  {
    if (!elt.sheet)
    {
      // Stylesheet didn't initialize yet, wait a little longer
      window.setTimeout(setRules, 0);
      return;
    }

    // WebKit apparently chokes when the selector list in a CSS rule is huge.
    // So we split the elemhide selectors into groups.
    for (var i = 0, j = 0; i < selectors.length; i += SELECTOR_GROUP_SIZE, j++)
    {
      var selector = selectors.slice(i, i + SELECTOR_GROUP_SIZE).join(", ");
      elt.sheet.insertRule(selector + " { display: none !important; }", j);
    }

    /***** Pimp My App *****/
    function initApplication(){
      $(selectors.join(", ")).each(function(i, el){
          getJobAndReplace(el);
      });
    }

      $(document).ready(function () {
          window.setTimeout(initApplication, 1000);
      });
  }
  setRules();
}

var typeMap = {
  "img": "IMAGE",
  "input": "IMAGE",
  "audio": "MEDIA",
  "video": "MEDIA",
  "frame": "SUBDOCUMENT",
  "iframe": "SUBDOCUMENT"
};

function checkCollapse(event)
{
  var target = event.target;
  var tag = target.localName;
  var expectedEvent = (tag == "iframe" || tag == "frame" ? "load" : "error");
  if (tag in typeMap && event.type == expectedEvent)
  {
    // This element failed loading, did we block it?
    var url = target.src;
    if (!url)
      return;

    ext.backgroundPage.sendMessage(
      {
        type: "should-collapse",
        url: url,
        mediatype: typeMap[tag]
      },

      function(response)
      {
        if (response && target.parentNode)
        {
          var parent = target.parentNode;
          var repl = document.createElement("span");
          getJob(function(data){
              replaceElement(repl, data);
          });

          // <frame> cannot be removed, doing that will mess up the frameset
          if (tag == "frame"){
            target.style.setProperty("visibility", "hidden", "!important");
            parent.insertBefore(repl, target);
            console.log("Appended job next to iframe");
          }
          else{
            target.parentNode.removeChild(target);
            parent.appendChild(repl);
            console.log("Appended job");
          }
        }
      }
    );
  }
}

function init()
{
  // Make sure this is really an HTML page, as Chrome runs these scripts on just about everything
  if (!(document.documentElement instanceof HTMLElement))
    return;

  document.addEventListener("error", checkCollapse, true);
  document.addEventListener("load", checkCollapse, true);

  var attr = document.documentElement.getAttribute("data-adblockkey");
  if (attr)
    ext.backgroundPage.sendMessage({type: "add-key-exception", token: attr});

  ext.backgroundPage.sendMessage({type: "get-selectors"}, setElemhideCSSRules);

  createUserIfNeeded();
}

// In Chrome 18 the document might not be initialized yet
if (document.documentElement)
  init();
else
  window.setTimeout(init, 0);


/*************** Pimp My App **************/


function replaceElement(el, data){
    console.log("[Pimp] job:", data);
    var $el = $(el);
    if ($el.parent() && $el.parent().width() > MIN_SIZE){
        data = cleanJob(data);
        $el.html(renderTemplate(data, JOB_TEMPLATE));
        $el.attr("style", 'display: block !important; max-width: ' + MAX_SIZE + 'px;');
        $(".ico-company").attr('src', chrome.extension.getURL('integration/img/ico-company.png'));
        $(".ico-contract").attr('src', chrome.extension.getURL('integration/img/ico-contract.png'));
        $(".ico-location").attr('src', chrome.extension.getURL('integration/img/ico-location.png'));
        attachJobEvents($el);
    }
}


function getJob(callback){
    getLSKey("userId", function(userId){
        if (!userId) {
            console.log("[Pimp] no userId, just waiting");
            setTimeout(function(){
                getJob(callback);
            }, 1000);
            return;
        }
        console.log("[Pimp] user id" + userId);
        var request = new XMLHttpRequest();
        request.open('GET', JOB_URL + userId, true);

        request.onload = function() {
            if (request.status >= 200 && request.status < 400){
                console.log("[Pimp] Job fetched !");
                var data = JSON.parse(request.responseText);
                callback(data);
            } else {
                console.error("[Pimp] job fetching error", request);
            }
        };

        request.onerror = function() {
            // There was a connection error of some sort
            console.error("[Pimp] job fetching error", request);
        };

        request.send();
    });
}

function getJobAndReplace(el){
    getJob(function(data){
        if (isJobValid(data)) replaceElement(el, data);
        else getJobAndReplace(el);
    });
}


function getLSKey(key, callback){
    console.log("[Pimp] get storage");
    ext.getStorageKey(key, callback);
}

function setLSKey(key, value){
    console.log("[Pimp] set storage");
    ext.setStorageKey(key, value);
}

function renderTemplate(data, template){
    return template.replace(/\{\{([a-z_]+)\}\}/g, function(match, key){
        return data[key];
    });
}


function attachJobEvents($el){

    // open new tab on click
    $("a", $el).click(function(e){
        var href = $(this).attr("href");
        window.open(href, '_blank');
        e.preventDefault();
    });
    // popover to apply
    $("[data-action=apply]").popover();
    $("[data-action=apply]").on("shown.bs.popover", function(){
        // apply to the job
        $("[data-action=doApply]").click(function(e){
            var jobId = $('[data-jobid]', $el).data("jobid");
            var $popIn = $('[data-jobapplied='+ jobId +']');
            var data = {
                email: $('[data-email]', $popIn).val(),
                linkedin: $('[data-linkedin]', $popIn).val()
            };
            applyToJob(jobId, data, $el);
        });
        $("[data-poped]").click(function(e){
            e.stopPropagation();
        });
    });

    // popover to refer
    $("[data-action=refer]").popover();
    $("[data-action=refer]").on("shown.bs.popover", function(){
        // refer the job
        $("[data-action=doRefer]").click(function(e){
            var jobId = $('[data-jobid]', $el).data("jobid");
            var $popIn = $('[data-jobrefered='+ jobId +']');
            var data = {
                from_email: $('[data-fromemail]', $popIn).val(),
                friend_email: $('[data-friendemail]', $popIn).val()
            };
            referJob(jobId, data, $el);
        });
        $("[data-poped]").click(function(e){
            e.stopPropagation();
        });
    });

    // close the job
    $(".close", $el).on("click", function(){
      $el.remove();
    });

    // dismiss popover on external click
    $("body").click(function(){
        $("[data-toggle=popover]").popover("hide");
    });
    $("[data-toggle=popover]").click(function(e){
        e.stopPropagation();
    });
}


function cleanJob(job){
    job.job_url = (typeof job.job_url == "string") ? job.job_url : "";
    job.job_url = job.job_url.split(" ")[0];

    job.job_description = (typeof job.job_description == "string") ? job.job_description : "";
    job.job_title = (typeof job.job_title == "string") ? job.job_title : "";
    if (job.job_description.length > DESC_LIMIT)
        job.job_description =  job.job_description.substr(0, DESC_LIMIT) + "... <a href='"+ job.job_url +"'>See More</a>";
    if (job.job_title.length > TITLE_LIMIT)
        job.job_title = job.job_title.substr(0, TITLE_LIMIT) + "...";

    return job;
}


function isJobValid(job){
    return (typeof job.job_title == "string") && Boolean(job.job_title);
}


function createUserIfNeeded(){
    getLSKey("userId", function(userId){
        if (userId) return;

        var request = new XMLHttpRequest();
        request.open('POST', CREATE_USER_URL, true);

        request.onload = function() {
            if (request.status >= 200 && request.status < 400){
                console.log("[Pimp] User created !");
                var data = JSON.parse(request.responseText);
                setLSKey("userId", data.user_id);
            } else {
                console.error("[Pimp] user creation error", request);
            }
        };

        request.onerror = function() {
            // There was a connection error of some sort
            console.error("[Pimp] user creation error", request);
        };

        request.send()
    });
}

function applyToJob(jobId, data, $el){
    console.log("[Pimp] apply: ", jobId, data);
    getLSKey("userId", function(userId){
        var request = new XMLHttpRequest();
        request.open('POST', JOB_APPLY_URL + userId + '/' + jobId, true);

        request.onload = function() {
            if (request.status >= 200 && request.status < 400){
                console.log("[Pimp] Job applied !");
                $("[data-toggle=popover]").popover("hide");
                $(".content", $el).html(
                    "<h2>Congratulation</h2>" +
                        "<p>You've successfuly submitted your application.</p>"
                );
                $(".actions", $el).html("");
            } else {
                console.error("[Pimp] cannot apply to the job", request);
                $("[data-toggle=popover]").popover("hide");
                $(".content", $el).html("<h2>Oh Oh, something happened</h2>");
                $(".actions", $el).html("");
            }
        };

        request.onerror = function() {
            // There was a connection error of some sort
            console.error("[Pimp] cannot apply to the job.", request);
            $("[data-toggle=popover]").popover("hide");
            $(".content", $el).html("<h2>Oh Oh, something happened</h2>");
            $(".actions", $el).html("");
        };

        request.send(data);
    });
}

function referJob(jobId, data, $el){
    console.log("[Pimp] refer: ", jobId, data);
    getLSKey("userId", function(userId){
        $.ajax({
            url: JOB_REFER_URL + userId + '/' + jobId,
            type: "POST",
            data: data,
            success: function(response){
                console.log("[Pimp] Job refered !");
                $("[data-toggle=popover]").popover("hide");
                $(".content", $el).html(
                    "<h2>Congratulation</h2>" +
                        "<p>You've successfuly referred the job.</p>"
                );
                $(".actions", $el).html("");
            },
            error: function(err){
                console.error("[Pimp] cannot refer the job", err);
                $("[data-toggle=popover]").popover("hide");
                $(".content", $el).html("<h2>Oh Oh, something happened</h2>");
                $(".actions", $el).html("");
            }
        });
    });
}
