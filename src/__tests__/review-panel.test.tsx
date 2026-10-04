import { fireEvent, screen } from '@testing-library/react-native';

import { ReviewPanel } from '@/features/admin/review-panel';
import { en } from '@/i18n/en';
import { renderWithQuery } from '@/test-utils';

describe('ReviewPanel', () => {
  it('approves straight away', async () => {
    const onApprove = jest.fn();
    await renderWithQuery(
      <ReviewPanel saving={false} onApprove={onApprove} onReject={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText(en.admin.approve));

    expect(onApprove).toHaveBeenCalled();
  });

  it('needs a reason to reject', async () => {
    const onReject = jest.fn();
    await renderWithQuery(<ReviewPanel saving={false} onApprove={jest.fn()} onReject={onReject} />);

    await fireEvent.press(screen.getByText(en.admin.reject));
    expect(screen.getByText(en.admin.reasonRequired)).toBeTruthy();
    expect(onReject).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(en.admin.reasonLabel), '  Photo is blurry ');
    await fireEvent.press(screen.getByText(en.admin.reject));
    expect(onReject).toHaveBeenCalledWith('Photo is blurry');
  });
});
