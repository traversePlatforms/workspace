<?php
require getenv('HOME') . '/www/traverseplatforms.com/public_html/outbox-092b0f/peak/lib.php';
$sig = "\n\nLooking forward to it,\n\nCai Silva\nPeak Pickleball\n\n--\nPeak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920\nIf you'd rather not get emails from Peak, reply and let me know.";
$M = [
 ['to' => ['dawn@wholistichealingexperiences.com'], 'cc' => ['appointments@wholistichealingexperiences.com'], 'subject' => 'Peak Pickleball and Wholistic Healing Experiences',
  'body' => "Hi Dawn,\n\nJess mentioned you're the right person to talk to about partnerships at Wholistic Healing Experiences. Peak Pickleball has a packed event calendar coming up, and we're bringing on a small number of health and wellness partners. That means Wholistic Healing Experiences would be one of only a few wellness brands in front of our players, members, and event crowds.\n\nWe'd love to schedule a quick 30-minute tour to see if it'd be a good fit, with no commitment. Would Monday at 3 pm or Tuesday at 1 pm work for you?"],
 ['to' => ['kamber@revrehab.com'], 'cc' => [], 'subject' => 'Following up from Peak Pickleball',
  'body' => "Hi Kamber,\n\nThanks for your time earlier this week, it was a pleasure speaking with you. As I mentioned, Peak Pickleball has a packed event calendar coming up, and we're bringing on a small number of health and wellness partners.\n\nThat means Revolution Rehabilitation would be one of only a few wellness brands in front of our players, members, and event crowds.\n\nI'd love to schedule a quick 30-minute tour of the facility, with no commitment. Would Monday or Tuesday next week work for you?"],
 ['to' => ['admin@avibrantyou.com'], 'cc' => [], 'subject' => 'Following up from Peak Pickleball',
  'body' => "Hi Erin,\n\nThanks for your time earlier this week, it was a pleasure speaking with you. As I mentioned, Peak Pickleball has a packed event calendar coming up, and we're bringing on a small number of health and wellness partners.\n\nThat means Vibrant Health & Wellness would be one of only a few wellness brands in front of our players, members, and event crowds.\n\nI appreciate you helping connect me with whoever makes the decisions on partnerships. The best way to see if it's a fit is a 30- to 45-minute tour, with no commitment.\n\nLooking forward to connecting further."],
 ['to' => ['mwgonzalez@selectmedical.com'], 'cc' => [], 'subject' => 'Peak Pickleball and Select Physical Therapy',
  'body' => "Hi Melanie,\n\nTashira mentioned you're the right person to talk to about partnerships at Select Physical Therapy. Peak Pickleball has a packed event calendar coming up, and we're bringing on a small number of health and wellness partners.\n\nThat means Select Physical Therapy would be one of only a few health brands in front of our players, members, and event crowds.\n\nI'd love to set up a time for you to tour the facility. The best way to see if it's a fit is a 30-minute tour, with no commitment. Would Monday or Tuesday next week work for you?"],
 ['to' => ['cj@lakesideautobrokers.com'], 'cc' => [], 'subject' => 'Following up from Peak Pickleball',
  'body' => "Hi CJ,\n\nThanks for your time earlier this week, and for being upfront about this year's budget. That actually works well, because Peak Pickleball is planning its 2027 event calendar now, and we're keeping our partner spots to a small number.\n\nThat means Lakeside Auto Brokers would be one of only a few brands in front of our players, members, and event crowds, and you'd get a first look before spots open up to others.\n\nThe best way to see if it's a fit before your new budget is set is a 30-minute tour, with no commitment. I know the holidays are hectic, so would either Monday or Tuesday after Thanksgiving work for you?"],
 ['to' => ['drwinterbower@gmail.com'], 'cc' => ['cosnucca@gmail.com'], 'subject' => 'Peak Pickleball, via Michelle',
  'body' => "Hi Dr. Winterbower,\n\nI had the privilege of connecting with your mom, Michelle, who thought a partnership with your practice could be a great fit. Peak Pickleball, the big indoor pickleball facility at Chapel Hills Mall, has a packed event calendar coming up, and we're bringing on a small number of health and wellness partners.\n\nThat means your practice would be one of only a few health brands in front of our players, members and event crowds, a very active group that knows the value of staying healthy and pain-free.\n\nMichelle mentioned you're traveling right now, so there's no rush. I wanted to put this on your radar, and I'd love to set up a quick 30- to 45-minute tour once you're back after Thanksgiving."],
];
$L = json_decode((string) @file_get_contents(pmData() . '/lists.json'), true) ?: [];
$skip = strtolower(json_encode($L['skips'] ?? []) . json_encode($L['left'] ?? []));
$dry = in_array('--dry', $argv, true);
foreach ($M as $m) {
  $all = array_merge($m['to'], $m['cc']); $bad = array_filter($all, fn($a) => str_contains($skip, strtolower($a)));
  if ($bad) { echo "SKIPPED (do-not-email): ", implode(',', $bad), "\n"; continue; }
  $rc = fn($xs) => array_map(fn($a) => ['emailAddress' => ['address' => $a]], $xs);
  $msg = ['subject' => $m['subject'], 'body' => ['contentType' => 'Text', 'content' => $m['body'] . $sig],
    'toRecipients' => $rc($m['to']), 'ccRecipients' => $rc($m['cc']), 'from' => ['emailAddress' => ['address' => PM_SHARED, 'name' => PM_SHARED_NAME]]];
  if ($dry) { echo "DRY ", implode(',', $all), " | ", $m['subject'], "\n"; continue; }
  [$s, $j] = pmGraph('POST', '/v1.0/users/' . rawurlencode(PM_SHARED) . '/sendMail', ['message' => $msg, 'saveToSentItems' => true]);
  echo $s === 202 ? "SENT " : "FAILED($s " . ($j['error']['code'] ?? '') . ") ", implode(',', $all), " | ", $m['subject'], "\n";
  usleep(800000);
}
