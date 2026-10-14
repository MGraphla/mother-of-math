# Mobile QA Checklist

## Authentication

- [ ] Sign up with email/password.
- [ ] Sign in with valid credentials.
- [ ] Reject invalid credentials.
- [ ] Reset password flow returns user to app via deep link.
- [ ] Sign out from every role home screen.

## Role Routing

- [ ] Teacher user lands in `/(roles)/teacher`.
- [ ] Parent user lands in `/(roles)/parent`.
- [ ] Student user lands in `/(roles)/student`.
- [ ] Admin user lands in `/(roles)/admin`.
- [ ] Monitor user lands in `/(roles)/monitor`.

## Native Modules

- [ ] Upload picker opens and returns a document.
- [ ] Download/share requests permissions and succeeds.
- [ ] Permission denied states show user-friendly feedback.

## Devices

- [ ] Android physical device smoke test.
- [ ] iOS physical device smoke test.
- [ ] Orientation, background/foreground session restore.
