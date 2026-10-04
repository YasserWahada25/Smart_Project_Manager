import { TestBed } from '@angular/core/testing';

import { IDENTITY_COLORS, identityColor, initials } from '../../colors';
import { Avatar, AvatarPerson } from './avatar';

describe('identity colors and initials', () => {
  it('gives each key a stable color of the palette', () => {
    expect(identityColor('u1')).toBe(identityColor('u1'));
    expect(IDENTITY_COLORS).toContain(identityColor('anything'));
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(identityColor));
    expect(colors.size).toBeGreaterThan(3);
  });

  it('builds initials from names', () => {
    expect(initials('Sara', 'Manager')).toBe('SM');
    expect(initials('Jean Pierre', 'Dupont')).toBe('JD');
    expect(initials('E-commerce platform')).toBe('EP');
    expect(initials('mobile')).toBe('M');
    expect(initials('', null)).toBe('?');
  });
});

describe('Avatar', () => {
  async function render(person: AvatarPerson | null, inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('person', person);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('.avatar') as HTMLElement;
  }

  it('shows the initials (drawn by CSS, not added to the text) on the identity color', async () => {
    const avatar = await render({ id: 'u1', firstName: 'Sara', lastName: 'Manager' });

    expect(avatar.dataset['initials']).toBe('SM');
    expect(avatar.textContent).toBe('');
    expect(avatar.style.background).not.toBe('');
    expect(avatar.getAttribute('title')).toBe('Sara Manager');
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
  });

  it('can carry the name for assistive technologies, and shows an empty circle without person', async () => {
    const labelled = await render(
      { firstName: 'Youssef', lastName: 'Alami' },
      { labelled: true, size: 'large' },
    );
    expect(labelled.getAttribute('role')).toBe('img');
    expect(labelled.getAttribute('aria-label')).toBe('Youssef Alami');
    expect(labelled.classList).toContain('large');

    TestBed.resetTestingModule();
    const empty = await render(null, { labelled: true });
    expect(empty.classList).toContain('empty');
    expect(empty.getAttribute('aria-label')).toBe('Unassigned');
  });
});
