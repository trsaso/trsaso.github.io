$(function () {
    var duration = 3500;
    var slides = $(".slider img").length;
    var i = 1;
    $(".slider img:nth-child(1)").addClass("active animated flipInX");
    // Slide the images
    function slide() {
        if (i <= slides) {
            var imagelocation = ".slider img:nth-child(" + i + ")";
            var navlocation = ".nav a:nth-child(" + i + ")";
            $(imagelocation).siblings().removeClass("active animated flipInX");
            $(imagelocation).addClass("active animated flipInX");
            $(navlocation).siblings().removeClass("navActive");
            $(navlocation).addClass("navActive");
        }
        if (i == 0) {
            i = slides;
        }
        if (i < 0) {
            i = 0;
        }
    }
    // Add navigation blips
    var blips = 0;
    for (var nav = 0; nav < slides; nav++) {
        $(".nav").append('<a href="#"></a>');
    }
    $(".nav a:first-child").addClass("navActive");
    // Configure the next/prev buttons
    $('.next').click(function () {
        clearInterval(timer);
        if (i == slides) {
            i = 1;
        } else {
            i++
        }
        slide();
        console.log(i);
    })
    $('.prev').click(function () {
        clearInterval(timer);
        if (i == 1) {
            i = slides;
        } else {
            i--
        }
        slide();
        console.log(i);
    })
    // Autoplay
    timer = setInterval(function () {
        i++;
        if (i > slides) {
            i = 1;
        }
        slide();
    }, duration);
});