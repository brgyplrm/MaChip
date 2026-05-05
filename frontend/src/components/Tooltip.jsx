const Tooltip = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <button data-tooltip-target="tooltip-animation" type="button" class="text-white bg-brand box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none">Animated tooltip</button>

            <div id="tooltip-animation" role="tooltip" class="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-dark rounded-base shadow-xs opacity-0 tooltip">
                Tooltip content
                <div class="tooltip-arrow" data-popper-arrow></div>
            </div>
        </div>
    );
}

export default Tooltip;