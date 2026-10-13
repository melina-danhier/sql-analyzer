import type {MouseEventHandler, RefObject} from "react";

export type ButtonVariant = "primary" | "danger" | "success" | "secondary";

interface ButtonProps {
    text: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    variant?: ButtonVariant;
    bgColor?: string;
    className?: string;
    type?: "button" | "submit";
    disabled?: boolean;
    ref?: RefObject<HTMLButtonElement | null>;
}

export default function Button({
    text,
    onClick,
    variant = "primary",
    bgColor,
    className = "",
    type = "button",
    disabled = false,
    ref
}: ButtonProps) {
    const variantClasses: Record<ButtonVariant, string> = {
        primary: "bg-button text-white",
        danger: "bg-button-neg text-white",
        success: "bg-button-pos text-white",
        secondary: "bg-gray-500 text-white"
    };

    const baseColor = bgColor ?? variantClasses[variant];
    const interactionClass = disabled
        ? "opacity-60 cursor-not-allowed"
        : "cursor-pointer hover:brightness-90";

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={`rounded px-4 py-2 font-medium transition ${baseColor} ${interactionClass} ${className}`.trim()}
        >
            {text}
        </button>
    );
}