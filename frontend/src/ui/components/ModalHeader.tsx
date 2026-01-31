import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { theme } from '../theme';

type Props = {
  title: string;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
};

export const ModalHeader: React.FC<Props> = ({
  title,
  onCancel,
  onConfirm,
  confirmLabel = 'Save',
  confirmDisabled,
  confirmLoading,
}) => {
  return (
    <View style={styles.header}>
      <Button label="Cancel" onPress={onCancel} variant="ghost" />
      <Text style={styles.title}>{title}</Text>
      {onConfirm ? (
        <Button
          label={confirmLabel}
          onPress={onConfirm}
          disabled={confirmDisabled}
          loading={confirmLoading}
        />
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  spacer: {
    width: 88,
  },
});
