/*************** Pimp My App **************/

var CREATE_USER_URL = "https://w4u-lerignoux.work4labs.com/w4d/pimpmyapp/create_user";

function init(){
    createUserIfNeeded();
}

function getLSKey(key){
    return window.localStorage.getItem("pimpMyApp__" + key);
}

function setLSKey(key, value){
    window.localStorage.setItem("pimpMyApp__" + key, value);
}

function createUserIfNeeded(){
    if (getLSKey("userId")) return;

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
}

init();
