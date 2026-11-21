import React from 'react';
import {render,screen} from '@testing-library/react';
import '@testing-library/jest-dom';  // these is to delay the check
import Hero from '../landing_page/home/Hero';

//Test suite
describe('Hero component', ()=>{
    test('renders hero image' , ()=>{
        render(<Hero/>);
        const heroimage = screen.getByAltText('Hero Image');
        expect(heroimage).toBeInTheDocument();
        expect(heroimage).toHaveAttribute('src', 'media/images/homeHero.png');
    });
});