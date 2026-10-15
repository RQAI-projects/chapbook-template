# Business sites and appointments

Choose a personal or business theme in Chapbook or Atelier’s site settings. The template has 28 themes; the eight new options are Folio, Practice, Petal, Contour, Cut, Still, Office and Portrait. Themes change presentation, not ownership of your content. Older sites show the themes installed in their own repository.

Open **Practice or business details** in site settings to enter your introduction, location, public contact details, qualifications, services, durations and prices. Blank fields stay absent. Use only qualifications and claims you can substantiate. The beauty and practice layouts work without stock photographs, invented reviews or visitor counters.

## Connect appointments

1. Create your own Cal.com account and connect the calendar whose availability should be checked. Set your time zone, availability, appointment length, buffers, notice period, location and cancellation policy there.
2. Create an event type for each service you offer. Copy the public HTTPS event link, such as `https://cal.com/your-studio/consultation`, into **Booking page**. A link to another provider also works as an external booking link.
3. Save site settings and wait for the website deployment. An Appointments page is added to the navigation when a main booking link is configured. Cal.com event links offer a calendar inside the page, loaded only after the visitor presses **Open booking calendar**. A direct booking link stays available if JavaScript, the embed or a network request fails.
4. Optional: put a different booking link on each service. These buttons open the relevant provider event. Services without a link remain informational.
5. Configure confirmation and reminder emails in your booking provider. The provider holds appointment records and customer contact information; view, reschedule or cancel appointments in its dashboard. Chapbook does not store appointment records in your public GitHub repository.
6. Test availability, time zones, confirmation email delivery, cancellations and rescheduling using accounts you control before inviting customers.

## Paid appointments

Cal.com supports Stripe payments. Connect your business’s Stripe account in Cal.com and configure the charge and currency on each event type. The provider then handles checkout as part of booking. The website’s **Price** field is display text; it does not configure or collect a charge. Deposits, refunds and cancellation terms must be configured according to the payment/booking provider’s supported features and your own policies.

No calendar or merchant account is connected automatically. No payment keys belong in site settings or public source. This release verifies the website’s embed and fallback behavior, not a business’s real payment processing or email delivery. Complete a provider-supported test payment and a booking with an email address you control after connecting your accounts. No paid appointment or email was sent by the release tests.

For businesses with staff rosters, treatment rooms, resource constraints, packages or specialised salon operations, a dedicated service such as an existing salon booking system can be linked instead. Cal.com handles general scheduling; this release does not build a separate salon-management product.

Provider references checked 15 October 2026:
- [Cal.com embed](https://cal.com/embed)
- [Email and reminder workflows](https://cal.com/features/workflows)
- [Stripe payments](https://cal.com/features/payments)
- [Booking and cancellation FAQ](https://cal.com/scheduling/frequently-asked-questions)

Provider features, plan requirements and fees are controlled by those services. Verify them when connecting an account.
