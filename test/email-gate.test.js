/** @jest-environment jsdom */

const { EmailGate } = require('../js/email-gate');

describe('EmailGate logic tests', () => {
  let gate;

  beforeEach(() => {
    jest.spyOn(Storage.prototype, 'getItem');
    jest.spyOn(Storage.prototype, 'setItem');
    jest.spyOn(Storage.prototype, 'removeItem');
    localStorage.clear();
    jest.clearAllMocks();

    gate = new EmailGate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('validateEmail handles correct Caleb University email formats', () => {
    expect(gate.validateEmail('student@calebuniversity.edu.ng')).toBe(true);
    expect(gate.validateEmail('staff.member@calebuniversity.edu.ng')).toBe(true);
    expect(gate.validateEmail('student@student.calebuniversity.edu.ng')).toBe(true);
    expect(gate.validateEmail('STUDENT@CALEBUNIVERSITY.EDU.NG')).toBe(true);
  });

  test('validateEmail rejects typo domains (missing i)', () => {
    expect(gate.validateEmail('student@calebunversity.edu.ng')).toBe(false);
  });

  test('validateEmail rejects general non-university domains', () => {
    expect(gate.validateEmail('student@gmail.com')).toBe(false);
    expect(gate.validateEmail('student@yahoo.co.uk')).toBe(false);
    expect(gate.validateEmail('student@unilag.edu.ng')).toBe(false);
  });

  test('validateEmail rejects malformed strings, nulls, and blanks', () => {
    expect(gate.validateEmail('')).toBe(false);
    expect(gate.validateEmail(null)).toBe(false);
    expect(gate.validateEmail(undefined)).toBe(false);
    expect(gate.validateEmail('not-an-email')).toBe(false);
  });

  test('isVerified returns verification status from localStorage', () => {
    expect(gate.isVerified()).toBe(false);

    localStorage.setItem('curb_email_verified', 'true');
    expect(gate.isVerified()).toBe(true);
  });

  test('verify saves correct verification state to localStorage', () => {
    expect(gate.verify('student@calebuniversity.edu.ng')).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith('curb_email_verified', 'true');
    expect(gate.isVerified()).toBe(true);
  });

  test('verify rejects invalid email and does not save state', () => {
    expect(gate.verify('student@gmail.com')).toBe(false);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(gate.isVerified()).toBe(false);
  });

  test('reset clears verification state', () => {
    gate.verify('student@calebuniversity.edu.ng');
    expect(gate.isVerified()).toBe(true);

    gate.reset();
    expect(gate.isVerified()).toBe(false);
    expect(localStorage.removeItem).toHaveBeenCalledWith('curb_email_verified');
  });
});
