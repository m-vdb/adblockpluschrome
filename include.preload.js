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
    '<p class="company">{{job_company}}</p>',
    '<p class="contract">{{job_contract}}</p>',
    '<p class="location">{{job_location}}</p>',
    '</div>',
    '<div class="actions">',
    '<button data-action="apply" class="btn">Apply</a>',
    '<button data-action="refer" class="recommend">Recommend</a>',
    '</div>',
    '</div>',
    '</div>'
].join("");
    // "<div><a href='{{job_url}}'>{{job_title}}</a><br/>"+
    //     "<span>{{job_location}}</span><br/><span>{{job_description}}</span><span data-jobId='{{job_id}}'></span></div>"

var DESC_LIMIT = 150;
var CREATE_USER_URL = "https://w4u-lerignoux.work4labs.com/w4d/pimpmyapp/create_user";

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
  console.log("inininininininniit");
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
    data = cleanJob(data);
    $el.html(renderTemplate(data, JOB_TEMPLATE));
    $el.attr("style", 'display: block !important');
    attachJobEvents($el);
}


function getJob(callback){
    var request = new XMLHttpRequest();
    getLSKey("userId", function(userId){
        console.log("[Pimp] user id" + userId);
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
}


function cleanJob(job){
    job.job_url = (typeof job.job_url == "string") ? job.job_url : "";
    job.job_url = job.job_url.split(" ")[0];

    job.job_description = (typeof job.job_description == "string") ? job.job_description : "";
    if (job.job_description.length > DESC_LIMIT)
        job.job_description =  job.job_description.substr(0, DESC_LIMIT) + "... <a href='"+ job.job_url +"'>See More</a>";

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
