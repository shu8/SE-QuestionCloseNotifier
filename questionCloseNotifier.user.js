// ==UserScript==
// @name         Question close notifier
// @namespace    http://stackexchange.com/users/4337810/
// @version      1.0
// @description  A userscript that gives you a notification in your inbox if a question of yours has closed somewhere on the SE network
// @author       ᔕᖺᘎᕊ (http://stackexchange.com/users/4337810/)
// @match        *://*.stackexchange.com/*
// @match        *://*.stackoverflow.com/*
// @match        *://*.superuser.com/*
// @match        *://*.serverfault.com/*
// @match        *://*.askubuntu.com/*
// @match        *://*.stackapps.com/*
// @match        *://*.mathoverflow.net/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

var key = ")2kXF9IR5OHnfGRPDahCVg((",
    access_token,
    lastCheckedDate = 0, //1388534400000,//1433608505845,
    unread = {};

if (window.location.href.indexOf('/users/') > -1) { //Add the access token link
    $('.sub-header-links.fr').append('<span class="lsep">|</span><a href="javascript:;" id="questionCloseNotifierLink">question close notifier token</a>'); //Old profile (pre Feb-2015)
    $('.additional-links').append('<span class="lsep">|</span><a href="javascript:;" id="questionCloseNotifierLink">question close notifier token</a>'); //New profile (post Feb-2015)

    $('#questionCloseNotifierLink').click(function() { //save the token
        var token = window.prompt('To recieve a higher quota limit, you need to get an access token! You can get one at http://shu8.github.io/SE-QuestionCloseNotifier');
        if (token) {
            GM_setValue('QuestionCloseNotifier-access_token', token);
        }
    });
}

//Get the data from GM storage:
if (GM_getValue('QuestionCloseNotifier-access_token', -1) != -1) {
    access_token = JSON.parse(GM_getValue('QuestionCloseNotifier-access_token'));
} else {
    console.log("Question Close Notifier Error: Please get an access token and enter it by going to your profile page and clicking the 'question close notifier token' link at the top of the page. You can get an access token at http://shu8.github.io/SE-QuestionCloseNotifer!");
}
if (GM_getValue('QuestionCloseNotifier-lastCheckedDate', -1) != -1) {
    lastCheckedDate = JSON.parse(GM_getValue('QuestionCloseNotifier-lastCheckedDate'));
}
if (GM_getValue('QuestionCloseNotifier-unreadItems', -1) != -1) {
    unread = JSON.parse(GM_getValue('QuestionCloseNotifier-unreadItems'));
}


if (GM_getValue('QuestionCloseNotifier-sitesAndIdsToCheck', -1) != -1) {
    sitesAndIdsToCheck = JSON.parse(GM_getValue('QuestionCloseNotifier-sitesAndIdsToCheck'));
} else { //id sites and ids object has not been set
    var currentUserId = $('.profile-me').attr('href').split('/')[2], //get the required data
        currentSite = $(location).attr('hostname').split('www.'),
        networkId,
        sitesAndIdsToCheck = {};
    var getAccountIdUrl = 'https://api.stackexchange.com/2.2/users/' + currentUserId + '?order=desc&sort=reputation&site=' + currentSite;
    $.getJSON(getAccountIdUrl, function(json) { //get the *network* ID
        networkId = json.items[0].account_id;
        var allSitesIdsUrl = 'https://api.stackexchange.com/2.2/users/' + networkId + '/associated';
        $.getJSON(allSitesIdsUrl, function(json) { //get all the other account based on the *network* ID
            for (i = 0; i < json.items.length; i++) {
                siteNameSplit = json.items[i].site_url.split('://')[1]; //get the sitename, eg: meta.stackexchange.com
                sitesAndIdsToCheck[siteNameSplit] = json.items[i].user_id; //add to object
            }
            GM_setValue('QuestionCloseNotifier-sitesAndIdsToCheck', JSON.stringify(sitesAndIdsToCheck)); //save the object
        });
    });
}

$.each(sitesAndIdsToCheck, function(sitename, id) { //for each site...
    var url = "https://api.stackexchange.com/2.2/search/advanced?order=desc&sort=activity&closed=True&user=" + id + "&site=" + sitename + "&key=" + key + "&access_token=" + access_token;
    if (new Date().getDate() != new Date(lastCheckedDate).getDate()) { //if the current date is not equal to the last checked date (ie. don't check on the same day)
        $.getJSON(url, function(json) {
            for (i = 0; i < json.items.length; i++) {
                if (json.items[i].closed_date > ((lastCheckedDate / 1000) - 86400)) { //if it's been closed **since** you've last checked (minus one day), show it
                    if (!unread[sitename + '-' + json.items[i].question_id]) { //if it doesn't already exist (hasn't already been saved - no reason it should exist, but let's be safe from dupes...)
                        unread[sitename + '-' + json.items[i].question_id] = [json.items[i].link, json.items[i].title, json.items[i].closed_reason, json.items[i].question_id]; //add it to the unread object
                        GM_setValue('QuestionCloseNotifier-unreadItems', JSON.stringify(unread)); //save the unread object
                    }
                }
            }
            lastCheckedDate = new Date().getTime(); //save the current time
            GM_setValue('QuestionCloseNotifier-lastCheckedDate', JSON.stringify(lastCheckedDate));
        });
    } else {
        $.each(unread, function(siteAndId, details) { //add the notifications for the questions that have *already* been found
            addNotification(details[0], details[1], details[2], details[3], siteAndId.split('-')[0]);
        });
        addNumber();
    }
});

$.each(unread, function(siteAndId, details) {
    addNotification(details[0], details[1], details[2], details[3], siteAndId.split('-')[0]); //for the questions that have just been found
});
addNumber();

$(document).on('click', 'span[id^=markAsRead]', function(e) { //click handler for the 'mark as read' button
    e.preventDefault(); //don't go to questionn
    var siteAndId = $(this).attr('id').split('_')[1];
    delete unread[siteAndId]; //delete the question from the object
    GM_setValue('QuestionCloseNotifier-unreadItems', JSON.stringify(unread)); //save the object again
    $(this).parent().parent().parent().parent().parent().hide(); //hide the notification in the inbox dropdown
});

$(document).mouseup(function(e) { //hide on click off
    var container = $('div.topbar-dialog.inbox-dialog.dno > div.modal-content');
    if (!container.is(e.target) && container.has(e.target).length === 0) {
        container.find('.question-close-notification').remove();
    }
});

function addNotification(link, title, reason, id, sitename) { //add the notification
    var favicon;
    if (sitename.split('.')[0] == 'meta') { //get the icon needed for the site
        favicon = 'stackexchangemeta';
    } else {
        favicon = sitename.split('.')[0];
    }
    $('div.topbar .icon-inbox').click(function() { //add the actual notification
        setTimeout(function() {
            $('div.topbar div.topbar-dialog.inbox-dialog.dno ul').prepend("<li class='inbox-item unread-item question-close-notification'> \
<a href='" + link + "'> \
<div class='site-icon favicon favicon-" + favicon + "' title=''></div> \
<div class='item-content'> \
<div class='item-header'> \
<span class='item-type'>question closure</span> \
<span class='item-creation'><span style='color:blue;border: 1px solid gray;' onclick='javascript:void(0)' id='markAsRead_" + sitename + '-' + id + "'>mark as read</span></span> \
</div> \
<div class='item-location'>" + title + "</div> \
<div class='item-summary'>Your question has been closed with the reason '<strong>" + reason + "</strong>'! Go check it out, improve it and get it reopened!</div> \
</div> \
</a> \
</li>");
        }, 500);
    });
}

function addNumber() { //count the number of elements in the 'unread' object, and display that number on the inbox icon
    var count = 0;
    for (i in unread) {
        if (unread.hasOwnProperty(i)) {
            count++;
        }
    }
    if (count != 0 && $('div.topbar .icon-inbox span.unread-count').text() == '') { //display the number
        $('div.topbar .icon-inbox span.unread-count').css('display', 'inline-block').text(count);
    }
}
