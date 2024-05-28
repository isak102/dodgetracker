import Link from "next/link";
import Logo from "./Logo";
import NavbarLink from "./NavbarLink";
import RegionSelector from "./RegionSelector";
import SearchBar from "./SearchBar";

function NavBar() {
  return (
    <nav className="flex justify-between bg-zinc-800 p-2">
      <div className="flex items-center gap-1">
        <section className="flex border-r border-zinc-700">
          <Logo />
          <RegionSelector className="mr-1" />
        </section>
        <SearchBar />
        <section className="flex pl-2">
          <NavbarLink path={"Leaderboard"} />
        </section>
      </div>
      <section className="flex items-center">
        <Link href="/about">
          <div className="text-lg md:text-xl">About</div>
        </Link>
      </section>
    </nav>
  );
}

export default NavBar;
