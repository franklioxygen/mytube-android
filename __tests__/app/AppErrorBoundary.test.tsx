import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AppErrorBoundary } from '../../src/app/components/AppErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('boom');
  return <Text>safe</Text>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('renders children when no error', () => {
    const { getByText } = render(
      <AppErrorBoundary>
        <Boom shouldThrow={false} />
      </AppErrorBoundary>
    );
    expect(getByText('safe')).toBeTruthy();
  });

  test('renders the fallback UI when a child throws', () => {
    const { getByText } = render(
      <AppErrorBoundary>
        <Boom shouldThrow={true} />
      </AppErrorBoundary>
    );
    expect(getByText('Something went wrong.')).toBeTruthy();
    expect(getByText(/boom/)).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
  });

  test('Retry button clears the error and re-renders children', () => {
    const { getByText, rerender, queryByText } = render(
      <AppErrorBoundary>
        <Boom shouldThrow={true} />
      </AppErrorBoundary>
    );
    // Update the children first so the next render after Retry does not re-throw.
    rerender(
      <AppErrorBoundary>
        <Boom shouldThrow={false} />
      </AppErrorBoundary>
    );
    fireEvent.press(getByText('Retry'));
    expect(queryByText('Something went wrong.')).toBeNull();
  });
});
