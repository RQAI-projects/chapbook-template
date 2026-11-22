// Add to calendar (owner, 22 Nov): one calendar file for each dated class or event in Spaces
// remaining that has a start time, made when the website is built (RFC 5545, times in UTC from
// the business's own time zone). A Spaces remaining row links here with the download attribute,
// for Apple, Outlook and other calendars. Chapbook stores and sends nothing.
import { blockPages } from '../../lib/pages/site-pages';
import { calendarFiles } from '../../lib/pages/render.mjs';
import { site } from '../../lib/site';

export function getStaticPaths() {
  return calendarFiles(blockPages, { site }).map((f) => ({ params: { file: f.name }, props: { text: f.text } }));
}
export function GET({ props }) {
  return new Response(props.text, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
}
