import * as first from './tmp/first.types.generated';

describe('cyclical test', () => {
  it('allows cyclically depending objects', () => {
    expect(
      first.typeFirstObject
        .maker({
          target: {
            target: {
              target: {}
            }
          }
        })
        .success()
    ).toEqual({
      target: { target: { target: {} } }
    });
  });
});
