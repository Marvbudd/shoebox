So you want to help? Here are the ideas I have decided to target and I would love to hear your ideas too.

  1. Ability to click on a name in shoebox and a link opens to the Second Site entry for that person. This requires entering the TMG ID for each person in accessions.json. Second Site already supports this as described below.
        // https://groups.google.com/g/ss-l/c/Mgx-4Ko_OH8<br>
        // John Cardinal<br>
        // Jan 30, 2022, 11:22:30 PM<br>
        // to ss...@googlegroups.com<br>
        // Neil,<br>
        // IF you leave some important properties in the Pages.Page Sizes section at their default values, <br>
        // people's URLs will not change when you update your TMG data or change who is included in the site.<br>
        // 1 – Leave People per Page at the default value, which is 30. This isn't necessary for static URLs, <br>
        //     but it's a good idea You can use a slightly lower number if you want, say 25. <br>
        //     Also, set the One Person Script to checked, the default.<br>
        // 2 – Leave Person Page Sequence set to "By TMG ID"<br>
        // 3 – Leave the Static Page Assignments checkbox checked.<br>
        // 4 – Leave the Use Person Page Groups checkbox checked.<br>
        // Once you set these values and then publish your site, don't change them. For example, don't change <br>
        // People per Page to some other number. That will move people. The subsequent URLs will be static <br>
        // (they won't change based adding or removing people), but they won't be the same as they were.<br>
        // The default settings are not an accident. They were chosen for several reasons, one of which is <br>
        // to produce static URLs.<br>
        // John Cardinal<br>

  2. Improve the metadata editing to encompass the full json schema. The Edit Media currently is crude and error-prone.

  3. Each person's face in a picture should be identified like social media tags. Maybe we can process the photo and store a list of rectangles for the faces as described [here](https://www.sitepoint.com/face-detection-nodejs-opencv/) and there are others.

I only have experience with this project. So if you are more experienced than I am please be patient as I develop policies. 

On my laptop, I use Visual Studio Code for development and this year Copilot has been a great friend. I'll be learning React as I learn attempt the above additions. As the need arises I'll develop this section.