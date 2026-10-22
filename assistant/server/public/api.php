<?php
/* The page's only door to the assistant; the code and the data are outside public_html. ASSISTANT_PRIVATE can point elsewhere (the test server). */
require (getenv('ASSISTANT_PRIVATE') ?: dirname(__DIR__, 2) . '/assistant-private') . '/app.php';
