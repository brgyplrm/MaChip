const CardForm = () => {
    return (
        <div class="w-full max-w-sm bg-neutral-primary-soft p-6 border border-default rounded-base shadow-xs">
            <form action="#">
                <h5 class="text-xl font-semibold text-heading mb-6">Sign in to our platform</h5>
                <div class="mb-4">
                    <label for="email" class="block mb-2.5 text-sm font-medium text-heading">Your email</label>
                    <input type="email" id="email" class="bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs placeholder:text-body" placeholder="example@company.com" required />
                </div>
                <div>
                    <label for="password" class="block mb-2.5 text-sm font-medium text-heading">Your password</label>
                    <input type="password" id="password" class="bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand block w-full px-3 py-2.5 shadow-xs placeholder:text-body" placeholder="•••••••••" required />
                </div>
                <div class="flex items-start my-6">
                    <div class="flex items-center">
                        <input id="checkbox-remember" type="checkbox" value="" class="w-4 h-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft"/>
                        <label for="checkbox-remember" class="ms-2 text-sm font-medium text-heading">Remember me</label>
                    </div>
                    <a href="#" class="ms-auto text-sm font-medium text-fg-brand hover:underline">Lost Password?</a>
                </div>
                <button type="submit" class="text-white bg-brand box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none w-full mb-3">Login to your account</button>
                <div class="text-sm font-medium text-body">Not registered? <a href="#" class="text-fg-brand hover:underline">Create account</a></div>
            </form>
        </div>
    );
};

export default CardForm;