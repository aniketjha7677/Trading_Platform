import React from 'react'
import Hero from './Hero';
import Awards from './Awards';
import Education from './Education';
import Stats from './Stats';
import Pricing from './Pricing';
import OpenAcoount from '../OpenAcoount';

function HomePage() {
    return ( 
        <>
            <Hero/>
            <Awards/>
            <Stats/>
            <Pricing/>
            <Education/>
            <OpenAcoount/>
        </>
     );
}

export default HomePage;